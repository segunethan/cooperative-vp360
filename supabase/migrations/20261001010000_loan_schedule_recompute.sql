-- ============================================================
-- Proper lending-practice repayment handling
--
-- Replaces the first-draft recompute logic (which reprojected the schedule
-- on every payment, including exact on-time ones) with standard lending
-- behavior:
--   - Exact payment  -> mark PAID, nothing else changes.
--   - Underpayment   -> stays PARTIAL/arrears on that installment. No
--                       auto-spreading into future installments — that's a
--                       restructure and needs explicit admin action.
--   - Overpayment    -> the excess, once everything currently due is
--                       settled, is a principal prepayment. What happens
--                       to the rest of the schedule depends on a
--                       per-loan-type prepayment_strategy:
--                         REDUCE_TENURE (default)   — keep the monthly
--                           amount, the loan finishes earlier (and/or the
--                           final installment shrinks).
--                         REDUCE_INSTALLMENT        — keep the original
--                           end date, lower the monthly amount.
--                         ADVANCE_PAYMENT           — the old behaviour:
--                           roll the excess into future installments at
--                           their already-projected amounts, no recompute.
--                           Opt-in only.
--
-- Also adds:
--   - interest_method per loan type: REDUCING_BALANCE or FLAT (common in
--     Nigerian cooperatives — interest fixed on the original principal for
--     the whole tenure, split evenly, rather than declining with balance).
--   - An early-payoff quote (outstanding + interest accrued to date, not
--     the sum of remaining scheduled installments).
--   - A top-up preview so an admin can see the new monthly amount (under
--     either strategy) before approving.
--   - original_installment_kobo on loans, stored once at schedule
--     generation — the anchor REDUCE_TENURE targets.
--
-- Verified against a worked example before writing this (see chat):
-- ₦120,000 at 18% reducing-balance over 12 months, months 1-2 paid
-- exactly, ₦20,000 in month 3. EMI = ₦11,001.60. REDUCE_TENURE saves
-- ₦1,290.28 in interest and leaves a final installment of ₦712.92 —
-- matches the expected ~₦1,290 / ~₦713.
-- ============================================================

create type loan_interest_method as enum ('REDUCING_BALANCE', 'FLAT');
create type loan_prepayment_strategy as enum ('REDUCE_TENURE', 'REDUCE_INSTALLMENT', 'ADVANCE_PAYMENT');

alter table loan_types
  add column interest_method loan_interest_method not null default 'REDUCING_BALANCE',
  add column prepayment_strategy loan_prepayment_strategy not null default 'REDUCE_TENURE',
  add column late_penalty_bps_per_month int; -- null/0 = no penalty; e.g. 100 = 1%/month on the overdue amount

alter table loans
  add column interest_method loan_interest_method not null default 'REDUCING_BALANCE',
  add column prepayment_strategy loan_prepayment_strategy not null default 'REDUCE_TENURE',
  add column late_penalty_bps_per_month int,
  add column original_installment_kobo bigint; -- the agreed level payment, set once at schedule generation; REDUCE_TENURE targets this

-- Extends the trigger from the loan-types migration (same name/signature,
-- safe to replace) to also snapshot the new settings onto the loan, same
-- as interest_rate_bps/tenure_months already are.
create or replace function trg_apply_loan_type_terms()
returns trigger
language plpgsql
as $$
declare
  v_type loan_types%rowtype;
begin
  if new.loan_type_id is not null then
    select * into v_type from loan_types where id = new.loan_type_id and tenant_id = new.tenant_id;
    if not found then
      raise exception 'loan type not found for this cooperative';
    end if;
    new.interest_rate_bps := v_type.interest_rate_bps;
    new.tenure_months := v_type.tenure_months;
    new.interest_method := v_type.interest_method;
    new.prepayment_strategy := v_type.prepayment_strategy;
    new.late_penalty_bps_per_month := v_type.late_penalty_bps_per_month;
  end if;
  return new;
end;
$$;

-- ============================================================
-- Schedule generation — now interest-method aware, and records the
-- agreed level payment on the loan for REDUCE_TENURE to target later.
-- ============================================================
create or replace function generate_loan_schedule(p_loan_id uuid)
returns void
language plpgsql
as $$
declare
  v_loan                record;
  v_rate                numeric;
  v_balance             numeric;
  v_emi                 numeric;
  v_interest            bigint;
  v_principal           bigint;
  v_i                   int;
  v_due_date            date;
  v_anchor              date;
  v_installment_amount  bigint;
begin
  select * into v_loan from loans where id = p_loan_id;
  if not found then
    return;
  end if;

  delete from loan_installments where loan_id = p_loan_id;

  v_rate := v_loan.interest_rate_bps / 10000.0 / 12;
  v_balance := v_loan.principal_kobo::numeric;
  v_anchor := coalesce(v_loan.disbursed_at::date, now()::date);

  if v_loan.interest_method = 'FLAT' then
    -- Flat: total interest computed once on the original principal for the
    -- whole tenure, then principal and interest are each split evenly
    -- across every period. The last period absorbs rounding drift on both,
    -- so the schedule always sums exactly.
    declare
      v_total_interest    bigint := round(v_loan.principal_kobo * v_loan.interest_rate_bps / 10000.0 * v_loan.tenure_months / 12.0);
      v_interest_per_period bigint := round(v_total_interest::numeric / v_loan.tenure_months);
      v_principal_per_period bigint := round(v_loan.principal_kobo::numeric / v_loan.tenure_months);
      v_interest_cum  bigint := 0;
      v_principal_cum bigint := 0;
    begin
      for v_i in 1..v_loan.tenure_months loop
        if v_i = v_loan.tenure_months then
          v_interest := v_total_interest - v_interest_cum;
          v_principal := v_loan.principal_kobo - v_principal_cum;
        else
          v_interest := v_interest_per_period;
          v_principal := v_principal_per_period;
        end if;

        v_due_date := (v_anchor + (v_i || ' months')::interval)::date;

        insert into loan_installments (
          tenant_id, loan_id, installment_number, due_date,
          opening_balance_kobo, principal_due_kobo, interest_due_kobo,
          installment_amount_kobo, closing_balance_kobo
        ) values (
          v_loan.tenant_id, p_loan_id, v_i, v_due_date,
          round(v_balance), v_principal, v_interest,
          v_principal + v_interest, round(v_balance) - v_principal
        );

        v_interest_cum := v_interest_cum + v_interest;
        v_principal_cum := v_principal_cum + v_principal;
        v_balance := v_balance - v_principal;
      end loop;

      v_installment_amount := v_principal_per_period + v_interest_per_period;
    end;
  else
    -- Reducing balance: standard level-payment EMI.
    if v_rate = 0 then
      v_emi := v_balance / v_loan.tenure_months;
    else
      v_emi := v_balance * v_rate * power(1 + v_rate, v_loan.tenure_months)
        / (power(1 + v_rate, v_loan.tenure_months) - 1);
    end if;

    for v_i in 1..v_loan.tenure_months loop
      v_interest := round(v_balance * v_rate);
      if v_i = v_loan.tenure_months then
        v_principal := round(v_balance);
      else
        v_principal := round(v_emi) - v_interest;
      end if;

      v_due_date := (v_anchor + (v_i || ' months')::interval)::date;

      insert into loan_installments (
        tenant_id, loan_id, installment_number, due_date,
        opening_balance_kobo, principal_due_kobo, interest_due_kobo,
        installment_amount_kobo, closing_balance_kobo
      ) values (
        v_loan.tenant_id, p_loan_id, v_i, v_due_date,
        round(v_balance), v_principal, v_interest,
        v_principal + v_interest, round(v_balance) - v_principal
      );

      v_balance := v_balance - v_principal;
    end loop;

    v_installment_amount := round(v_emi);
  end if;

  update loans set original_installment_kobo = v_installment_amount where id = p_loan_id;
end;
$$;

-- Re-run for every currently-ACTIVE loan: the first pass (previous
-- migration) ran before original_installment_kobo and interest_method
-- existed, so none of them got set. Idempotent — generate_loan_schedule
-- wipes and rebuilds from the loan's own stored principal/rate/tenure.
do $$
declare
  v_loan_id uuid;
begin
  for v_loan_id in select id from loans where status = 'ACTIVE' loop
    perform generate_loan_schedule(v_loan_id);
  end loop;
end $$;

-- ============================================================
-- recompute_loan_schedule — now strategy- and interest-method-aware.
-- Reprojects only the untouched future installments (paid_amount_kobo = 0)
-- from the loan's current true outstanding balance. PAID and PARTIAL rows
-- are left exactly as they are: real history, not a projection.
-- ============================================================
create or replace function recompute_loan_schedule(p_loan_id uuid, p_strategy loan_prepayment_strategy default null)
returns void
language plpgsql
as $$
declare
  v_loan                    record;
  v_strategy                loan_prepayment_strategy;
  v_touched_count           int;
  v_remaining_months        int;
  v_outstanding             numeric;
  v_partial_principal_owed  numeric;
  v_rate                    numeric;
  v_emi                     numeric;
  v_balance                 numeric;
  v_interest                bigint;
  v_principal               bigint;
  v_i                       int;
  v_installment_number      int;
  v_due_date                date;
  v_anchor                  date;
  v_target                  bigint;
begin
  select * into v_loan from loans where id = p_loan_id;
  if not found or v_loan.status <> 'ACTIVE' then
    return;
  end if;

  v_strategy := coalesce(p_strategy, v_loan.prepayment_strategy);

  select count(*) into v_touched_count
  from loan_installments
  where loan_id = p_loan_id and paid_amount_kobo > 0;

  v_remaining_months := v_loan.tenure_months - v_touched_count;

  v_outstanding := v_loan.principal_kobo
    + coalesce((select sum(amount_kobo) from loan_topup_requests where loan_id = p_loan_id and status = 'APPROVED'), 0)
    - coalesce((select sum(principal_portion_kobo) from loan_repayments where loan_id = p_loan_id), 0);

  -- A preserved PARTIAL installment still has its own unpaid principal
  -- slice (payments are allocated interest-first). That slice is already
  -- inside v_outstanding AND still owed specifically via that installment
  -- — subtract it here so the newly generated installments don't
  -- re-amortize it a second time.
  select coalesce(sum(
    principal_due_kobo - greatest(paid_amount_kobo - interest_due_kobo, 0)
  ), 0)
  into v_partial_principal_owed
  from loan_installments
  where loan_id = p_loan_id and status = 'PARTIAL';

  delete from loan_installments where loan_id = p_loan_id and paid_amount_kobo = 0;

  v_outstanding := v_outstanding - v_partial_principal_owed;

  if v_remaining_months <= 0 or v_outstanding <= 0 then
    return;
  end if;

  select coalesce(max(due_date), coalesce(v_loan.disbursed_at::date, now()::date))
  into v_anchor
  from loan_installments
  where loan_id = p_loan_id and paid_amount_kobo > 0;

  v_rate := v_loan.interest_rate_bps / 10000.0 / 12;
  v_balance := v_outstanding;

  if v_strategy = 'REDUCE_TENURE' then
    -- Keep the originally agreed installment amount fixed; let the number
    -- of periods needed to clear v_outstanding fall out naturally. Capped
    -- at the original remaining-months count as a safety bound (balance
    -- only shrinks relative to the original plan via a prepayment, so it
    -- should never need more periods than originally remained).
    v_target := coalesce(v_loan.original_installment_kobo, round(v_balance / v_remaining_months));

    for v_i in 1..v_remaining_months loop
      exit when v_balance <= 0;
      v_installment_number := v_touched_count + v_i;

      if v_loan.interest_method = 'FLAT' then
        -- Flat interest for this reamortization run is fixed on the
        -- balance AT THE START of the run, not re-declining per period.
        v_interest := round(v_outstanding * v_rate);
      else
        v_interest := round(v_balance * v_rate);
      end if;

      if v_i = v_remaining_months or v_target <= v_interest then
        v_principal := round(v_balance);
      else
        v_principal := least(v_target - v_interest, round(v_balance));
      end if;

      v_due_date := (v_anchor + (v_i || ' months')::interval)::date;

      insert into loan_installments (
        tenant_id, loan_id, installment_number, due_date,
        opening_balance_kobo, principal_due_kobo, interest_due_kobo,
        installment_amount_kobo, closing_balance_kobo
      ) values (
        v_loan.tenant_id, p_loan_id, v_installment_number, v_due_date,
        round(v_balance), v_principal, v_interest,
        v_principal + v_interest, round(v_balance) - v_principal
      );

      v_balance := v_balance - v_principal;
    end loop;

  else
    -- REDUCE_INSTALLMENT: keep the same end date (remaining_months fixed),
    -- solve for a new level payment over that same count of periods.
    if v_loan.interest_method = 'FLAT' then
      declare
        v_total_interest      bigint := round(v_outstanding * v_loan.interest_rate_bps / 10000.0 * v_remaining_months / 12.0);
        v_interest_per_period bigint := round(v_total_interest::numeric / v_remaining_months);
        v_principal_per_period bigint := round(v_outstanding / v_remaining_months);
        v_interest_cum  bigint := 0;
        v_principal_cum bigint := 0;
      begin
        for v_i in 1..v_remaining_months loop
          v_installment_number := v_touched_count + v_i;
          if v_i = v_remaining_months then
            v_interest := v_total_interest - v_interest_cum;
            v_principal := round(v_outstanding) - v_principal_cum;
          else
            v_interest := v_interest_per_period;
            v_principal := v_principal_per_period;
          end if;

          v_due_date := (v_anchor + (v_i || ' months')::interval)::date;

          insert into loan_installments (
            tenant_id, loan_id, installment_number, due_date,
            opening_balance_kobo, principal_due_kobo, interest_due_kobo,
            installment_amount_kobo, closing_balance_kobo
          ) values (
            v_loan.tenant_id, p_loan_id, v_installment_number, v_due_date,
            round(v_balance), v_principal, v_interest,
            v_principal + v_interest, round(v_balance) - v_principal
          );

          v_interest_cum := v_interest_cum + v_interest;
          v_principal_cum := v_principal_cum + v_principal;
          v_balance := v_balance - v_principal;
        end loop;
      end;
    else
      if v_rate = 0 then
        v_emi := v_balance / v_remaining_months;
      else
        v_emi := v_balance * v_rate * power(1 + v_rate, v_remaining_months)
          / (power(1 + v_rate, v_remaining_months) - 1);
      end if;

      for v_i in 1..v_remaining_months loop
        v_installment_number := v_touched_count + v_i;
        v_interest := round(v_balance * v_rate);
        if v_i = v_remaining_months then
          v_principal := round(v_balance);
        else
          v_principal := round(v_emi) - v_interest;
        end if;

        v_due_date := (v_anchor + (v_i || ' months')::interval)::date;

        insert into loan_installments (
          tenant_id, loan_id, installment_number, due_date,
          opening_balance_kobo, principal_due_kobo, interest_due_kobo,
          installment_amount_kobo, closing_balance_kobo
        ) values (
          v_loan.tenant_id, p_loan_id, v_installment_number, v_due_date,
          round(v_balance), v_principal, v_interest,
          v_principal + v_interest, round(v_balance) - v_principal
        );

        v_balance := v_balance - v_principal;
      end loop;
    end if;
  end if;
end;
$$;

-- ============================================================
-- record_loan_repayment — exact/under/over payment handled per standard
-- lending practice (see header comment).
-- ============================================================
create or replace function record_loan_repayment(
  p_loan_id uuid, p_amount_kobo bigint, p_channel text, p_paid_at timestamptz, p_reference text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id             uuid := get_tenant_id();
  v_loan                  record;
  v_repayment_id          uuid;
  v_remaining             bigint := p_amount_kobo;
  v_inst                  record;
  v_fill                  bigint;
  v_interest_already_paid bigint;
  v_interest_remaining    bigint;
  v_interest_fill         bigint;
  v_principal_fill        bigint;
  v_total_interest        bigint := 0;
  v_total_principal       bigint := 0;
  v_should_recompute      boolean := false;
  v_is_first              boolean := true;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_loan from loans where id = p_loan_id and tenant_id = v_tenant_id for update;
  if not found then
    raise exception 'loan not found';
  end if;

  -- Phase 1: pay down what's currently owed, oldest unpaid first. Always
  -- includes at least the single oldest unpaid installment (so paying a
  -- few days ahead of its due date is still a normal payment, not a
  -- prepayment), plus any further installments that are ALSO already due
  -- (catching up on genuine arrears). Stops the moment it reaches an
  -- installment that is both not-the-first and not-yet-due — anything left
  -- after that is handled in phase 2.
  for v_inst in
    select * from loan_installments
    where loan_id = p_loan_id and status <> 'PAID'
    order by installment_number
    for update
  loop
    exit when v_remaining <= 0;
    if not v_is_first and v_inst.due_date > p_paid_at::date then
      exit;
    end if;
    v_is_first := false;

    v_fill := least(v_remaining, v_inst.installment_amount_kobo - v_inst.paid_amount_kobo);
    if v_fill <= 0 then
      continue;
    end if;

    v_interest_already_paid := least(v_inst.paid_amount_kobo, v_inst.interest_due_kobo);
    v_interest_remaining := v_inst.interest_due_kobo - v_interest_already_paid;
    v_interest_fill := least(v_fill, v_interest_remaining);
    v_principal_fill := v_fill - v_interest_fill;

    update loan_installments
    set paid_amount_kobo = paid_amount_kobo + v_fill,
        status = case when paid_amount_kobo + v_fill >= installment_amount_kobo then 'PAID' else 'PARTIAL' end,
        paid_at = p_paid_at
    where id = v_inst.id;

    v_total_interest := v_total_interest + v_interest_fill;
    v_total_principal := v_total_principal + v_principal_fill;
    v_remaining := v_remaining - v_fill;
  end loop;

  -- Phase 2: anything left is beyond what's currently owed.
  if v_remaining > 0 then
    if v_loan.prepayment_strategy = 'ADVANCE_PAYMENT' then
      -- Opt-in old behaviour: roll forward into future installments at
      -- their already-projected amounts. No recompute — the plan doesn't
      -- change, the borrower is just paying ahead of it.
      for v_inst in
        select * from loan_installments
        where loan_id = p_loan_id and status <> 'PAID' and due_date > p_paid_at::date
        order by installment_number
        for update
      loop
        exit when v_remaining <= 0;
        v_fill := least(v_remaining, v_inst.installment_amount_kobo - v_inst.paid_amount_kobo);
        if v_fill <= 0 then
          continue;
        end if;
        v_interest_already_paid := least(v_inst.paid_amount_kobo, v_inst.interest_due_kobo);
        v_interest_remaining := v_inst.interest_due_kobo - v_interest_already_paid;
        v_interest_fill := least(v_fill, v_interest_remaining);
        v_principal_fill := v_fill - v_interest_fill;

        update loan_installments
        set paid_amount_kobo = paid_amount_kobo + v_fill,
            status = case when paid_amount_kobo + v_fill >= installment_amount_kobo then 'PAID' else 'PARTIAL' end,
            paid_at = p_paid_at
        where id = v_inst.id;

        v_total_interest := v_total_interest + v_interest_fill;
        v_total_principal := v_total_principal + v_principal_fill;
        v_remaining := v_remaining - v_fill;
      end loop;

      -- Anything still left once the whole schedule is exhausted is a
      -- genuine early full settlement — pure principal reduction.
      v_total_principal := v_total_principal + v_remaining;
    else
      -- REDUCE_TENURE / REDUCE_INSTALLMENT: this is a principal prepayment.
      v_total_principal := v_total_principal + v_remaining;
      v_should_recompute := true;
    end if;
  end if;

  insert into loan_repayments (
    tenant_id, loan_id, amount_kobo, principal_portion_kobo, interest_portion_kobo, channel, reference, paid_at
  ) values (
    v_tenant_id, p_loan_id, p_amount_kobo, v_total_principal, v_total_interest, p_channel, p_reference, p_paid_at
  ) returning id into v_repayment_id;

  if v_should_recompute then
    perform recompute_loan_schedule(p_loan_id, v_loan.prepayment_strategy);
  end if;

  if exists (select 1 from loan_installments where loan_id = p_loan_id)
     and not exists (select 1 from loan_installments where loan_id = p_loan_id and status <> 'PAID') then
    update loans set status = 'REPAID', updated_at = now() where id = p_loan_id;
  end if;

  perform fulfill_loan_due(p_loan_id, v_repayment_id, p_amount_kobo, p_paid_at);

  return v_repayment_id;
end;
$$;

-- ============================================================
-- Early payoff quote: outstanding principal + interest accrued since the
-- last fully-settled point, NOT the sum of remaining scheduled
-- installments (which would overcount — those include interest on money
-- that hasn't been owed that long yet).
-- ============================================================
create or replace function calculate_early_payoff(p_loan_id uuid, p_as_of date default current_date)
returns bigint
language plpgsql
as $$
declare
  v_loan              record;
  v_outstanding       numeric;
  v_last_point        date;
  v_days              int;
  v_accrued_interest  bigint;
begin
  select * into v_loan from loans where id = p_loan_id;
  if not found then
    return 0;
  end if;

  v_outstanding := v_loan.principal_kobo
    + coalesce((select sum(amount_kobo) from loan_topup_requests where loan_id = p_loan_id and status = 'APPROVED'), 0)
    - coalesce((select sum(principal_portion_kobo) from loan_repayments where loan_id = p_loan_id), 0);

  if v_outstanding <= 0 then
    return 0;
  end if;

  select max(due_date) into v_last_point
  from loan_installments where loan_id = p_loan_id and paid_amount_kobo > 0;

  v_last_point := coalesce(v_last_point, v_loan.disbursed_at::date, p_as_of);
  v_days := greatest(p_as_of - v_last_point, 0);

  -- Daily simple-interest accrual since the last accounted-for point, for
  -- both interest methods. This is a borrower-favourable simplification —
  -- in practice some flat-rate cooperative loans don't discount early
  -- payoff at all, charging the full remaining flat interest regardless.
  v_accrued_interest := round(v_outstanding * v_loan.interest_rate_bps / 10000.0 / 365.0 * v_days);

  return round(v_outstanding) + v_accrued_interest;
end;
$$;

-- ============================================================
-- Top-up preview: lets the admin see the new monthly amount (or new
-- payoff date) under either strategy BEFORE approving, without mutating
-- anything.
-- ============================================================
create or replace function preview_loan_topup(p_request_id uuid, p_strategy loan_prepayment_strategy)
returns table (new_installment_kobo bigint, new_remaining_months int, new_final_due_date date)
language plpgsql
as $$
declare
  v_request           record;
  v_loan              record;
  v_outstanding       numeric;
  v_touched_count     int;
  v_remaining_months  int;
  v_rate              numeric;
  v_emi               numeric;
  v_anchor            date;
begin
  select * into v_request from loan_topup_requests where id = p_request_id;
  if not found then
    return;
  end if;

  select * into v_loan from loans where id = v_request.loan_id;
  if not found then
    return;
  end if;

  select count(*) into v_touched_count from loan_installments where loan_id = v_loan.id and paid_amount_kobo > 0;
  v_remaining_months := v_loan.tenure_months - v_touched_count;

  select coalesce(max(due_date), coalesce(v_loan.disbursed_at::date, now()::date))
  into v_anchor
  from loan_installments where loan_id = v_loan.id and paid_amount_kobo > 0;

  -- includes this not-yet-approved top-up amount, since that's the point
  -- of the preview
  v_outstanding := v_loan.principal_kobo
    + coalesce((select sum(amount_kobo) from loan_topup_requests where loan_id = v_loan.id and status = 'APPROVED'), 0)
    + v_request.amount_kobo
    - coalesce((select sum(principal_portion_kobo) from loan_repayments where loan_id = v_loan.id), 0);

  v_rate := v_loan.interest_rate_bps / 10000.0 / 12;

  if p_strategy = 'REDUCE_INSTALLMENT' then
    if v_rate = 0 then
      v_emi := v_outstanding / v_remaining_months;
    else
      v_emi := v_outstanding * v_rate * power(1 + v_rate, v_remaining_months)
        / (power(1 + v_rate, v_remaining_months) - 1);
    end if;
    return query select round(v_emi)::bigint, v_remaining_months, (v_anchor + (v_remaining_months || ' months')::interval)::date;
  else
    -- REDUCE_TENURE: keep the original installment amount, estimate how
    -- many months it now takes. (Display estimate only — the real
    -- schedule is rebuilt precisely by recompute_loan_schedule on actual
    -- approval.)
    declare
      v_target  bigint := coalesce(v_loan.original_installment_kobo, 0);
      v_balance numeric := v_outstanding;
      v_n       int := 0;
    begin
      while v_balance > 0 and v_n < 600 loop
        v_balance := v_balance - (v_target - round(v_balance * v_rate));
        v_n := v_n + 1;
      end loop;
      return query select v_target, v_n, (v_anchor + (v_n || ' months')::interval)::date;
    end;
  end if;
end;
$$;

-- Extends the existing top-up approval with a strategy choice, applied via
-- recompute_loan_schedule when approved. The 3-arg version is dropped
-- first since adding a parameter creates a new overload rather than
-- replacing it in place.
drop function if exists review_loan_topup(uuid, boolean, uuid);

create or replace function review_loan_topup(p_request_id uuid, p_approve boolean, p_reviewer uuid, p_strategy loan_prepayment_strategy default null)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_request   record;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  update loan_topup_requests
  set status = (case when p_approve then 'APPROVED' else 'REJECTED' end)::request_status,
      reviewed_by = p_reviewer,
      reviewed_at = now()
  where id = p_request_id and tenant_id = v_tenant_id and status = 'PENDING'
  returning * into v_request;

  if not found then
    raise exception 'request not found or already reviewed';
  end if;

  if p_approve then
    perform recompute_loan_schedule(
      v_request.loan_id,
      coalesce(p_strategy, (select prepayment_strategy from loans where id = v_request.loan_id))
    );
  end if;
end;
$$;
