-- ============================================================
-- Loan Amortization Schedule
--
-- Today a loan has no repayment plan at all: record_loan_repayment()
-- charges interest on whatever the outstanding balance happens to be at
-- the moment someone pays, and the member can pay any amount at any time.
-- There's no answer to "how much am I supposed to pay this month" for
-- either the admin or the member.
--
-- This generates a real amortization schedule at disbursement time — a
-- fixed, level monthly installment (standard reducing-balance EMI, split
-- into principal + interest per period) covering exactly the loan's
-- tenure_months. Both the admin and the member can read it (same RLS
-- pattern as loan_repayments). record_loan_repayment() now applies each
-- payment against the oldest unpaid installment(s) instead of recomputing
-- interest from scratch, so the plan actually holds.
--
-- Known, deliberate scope limits (not silently mishandled — flagged):
-- - An approved loan top-up increases the outstanding balance for the
--   existing transaction-history view (fetchLoanLedger) but does NOT
--   regenerate the amortization schedule. Properly folding a mid-life
--   principal increase into a fixed schedule means recomputing the
--   remaining plan, which is out of scope for this pass.
-- - A payment that overpays past the full remaining schedule (early
--   full settlement) is applied as a straight principal reduction and the
--   loan is marked REPAID; it does not retroactively shrink earlier
--   installments.
-- ============================================================

create type loan_installment_status as enum ('PENDING', 'PARTIAL', 'PAID');

create table loan_installments (
  id                      uuid primary key default extensions.uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  loan_id                 uuid not null references loans(id) on delete cascade,
  installment_number      int not null check (installment_number > 0),
  due_date                date not null,
  opening_balance_kobo    bigint not null,
  principal_due_kobo      bigint not null,
  interest_due_kobo       bigint not null,
  installment_amount_kobo bigint not null,
  closing_balance_kobo    bigint not null,
  paid_amount_kobo        bigint not null default 0,
  status                  loan_installment_status not null default 'PENDING',
  paid_at                 timestamptz,
  created_at              timestamptz not null default now(),
  unique (loan_id, installment_number)
);

create index idx_loan_installments_loan on loan_installments(tenant_id, loan_id, installment_number);
create index idx_loan_installments_due on loan_installments(tenant_id, due_date) where status <> 'PAID';

alter table loan_installments enable row level security;

create policy "loan_installments_isolated" on loan_installments
  for all using (tenant_id = get_tenant_id());

create policy "loan_installments_self_select" on loan_installments
  for select using (
    loan_id in (
      select id from loans where member_id in (select id from members where auth_user_id = auth.uid())
    )
  );

-- Builds (or rebuilds) the fixed amortization schedule for a loan, using
-- the standard reducing-balance EMI formula over its principal/rate/tenure
-- as they stood at the time this is called. Idempotent — safe to re-run
-- (used both by the disbursement trigger below and by this migration's
-- one-time backfill for loans already ACTIVE before this migration).
create or replace function generate_loan_schedule(p_loan_id uuid)
returns void
language plpgsql
as $$
declare
  v_loan          record;
  v_rate          numeric;
  v_emi           numeric;
  v_balance       numeric;
  v_interest      bigint;
  v_principal     bigint;
  v_i             int;
  v_due_date      date;
  v_anchor        date;
begin
  select * into v_loan from loans where id = p_loan_id;
  if not found then
    return;
  end if;

  delete from loan_installments where loan_id = p_loan_id;

  v_rate := v_loan.interest_rate_bps / 10000.0 / 12;
  v_balance := v_loan.principal_kobo::numeric;
  v_anchor := coalesce(v_loan.disbursed_at::date, now()::date);

  if v_rate = 0 then
    v_emi := v_balance / v_loan.tenure_months;
  else
    v_emi := v_balance * v_rate * power(1 + v_rate, v_loan.tenure_months)
      / (power(1 + v_rate, v_loan.tenure_months) - 1);
  end if;

  for v_i in 1..v_loan.tenure_months loop
    v_interest := round(v_balance * v_rate);

    if v_i = v_loan.tenure_months then
      -- last installment absorbs rounding drift so principal_due sums
      -- exactly to the original principal, not principal +/- a few kobo
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
end;
$$;

create or replace function trg_generate_loan_schedule()
returns trigger
language plpgsql
as $$
begin
  perform generate_loan_schedule(new.id);
  return new;
end;
$$;

create trigger loans_generate_schedule_on_disburse
  after update on loans
  for each row
  when (new.status = 'ACTIVE' and old.status is distinct from 'ACTIVE')
  execute function trg_generate_loan_schedule();

-- Backfill: any loan already ACTIVE before this migration has no schedule
-- yet (the trigger above only fires on the PENDING/APPROVED -> ACTIVE
-- transition going forward) — generate one now using its stored
-- disbursed_at, so nothing already-disbursed is left without a plan.
do $$
declare
  v_loan_id uuid;
begin
  for v_loan_id in select id from loans where status = 'ACTIVE' loop
    perform generate_loan_schedule(v_loan_id);
  end loop;
end $$;

-- Replaces the old "interest on whatever the current balance is" logic
-- with applying the payment against the fixed schedule, oldest unpaid
-- installment first. Every existing caller (admin's Record Repayment,
-- member-submitted repayment request approval, payroll reconciliation)
-- goes through this one function, so this change propagates everywhere
-- without touching any of them.
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
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_loan from loans where id = p_loan_id and tenant_id = v_tenant_id for update;
  if not found then
    raise exception 'loan not found';
  end if;

  for v_inst in
    select * from loan_installments
    where loan_id = p_loan_id and status <> 'PAID'
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

  -- overpayment past the full remaining schedule: treat as pure principal
  -- reduction (early settlement) rather than rejecting or silently
  -- dropping the excess
  v_total_principal := v_total_principal + v_remaining;

  insert into loan_repayments (
    tenant_id, loan_id, amount_kobo, principal_portion_kobo, interest_portion_kobo, channel, reference, paid_at
  ) values (
    v_tenant_id, p_loan_id, p_amount_kobo, v_total_principal, v_total_interest, p_channel, p_reference, p_paid_at
  ) returning id into v_repayment_id;

  -- guard the vacuous case: a loan with no schedule at all (shouldn't
  -- happen given the trigger + backfill above, but must not silently
  -- flip REPAID if it ever does) only qualifies once it actually has
  -- installments and every one of them is PAID.
  if exists (select 1 from loan_installments where loan_id = p_loan_id)
     and not exists (select 1 from loan_installments where loan_id = p_loan_id and status <> 'PAID') then
    update loans set status = 'REPAID', updated_at = now() where id = p_loan_id;
  end if;

  perform fulfill_loan_due(p_loan_id, v_repayment_id, p_amount_kobo, p_paid_at);

  return v_repayment_id;
end;
$$;
