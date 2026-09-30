-- ============================================================
-- Payroll Deductions, Member Dues Schedule & Statements
--
-- Adds an opt-in payroll-deduction workflow for staff cooperatives,
-- on top of a generalized "member_dues" schedule that works for any
-- deduction method (cash, bank transfer, payroll) so the admin ledger
-- can show expected-vs-actual per cycle (including gaps) regardless of
-- how a member pays, and so members switching between payroll and cash
-- mid-year are handled correctly.
--
-- Nothing here changes behavior for a cooperative that never enables
-- payroll — every new column is nullable/defaulted and every new table
-- is populated only when dues are explicitly generated.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
create type deduction_method as enum ('CASH', 'BANK_TRANSFER', 'PAYROLL');

create type due_type as enum ('CONTRIBUTION', 'LOAN_INSTALLMENT');

create type due_status as enum ('OPEN', 'FULFILLED', 'PARTIAL', 'WAIVED');

create type payroll_batch_status as enum ('DRAFT', 'LOCKED', 'EXPORTED', 'RECONCILED');

create type payroll_batch_item_status as enum ('PENDING', 'DEDUCTED', 'PARTIAL', 'NOT_DEDUCTED');

-- ============================================================
-- TENANTS / MEMBERS — additive columns
-- ============================================================
alter table tenants
  add column payroll_enabled boolean not null default false;

alter table members
  add column employer_name text,
  add column staff_id text,
  add column deduction_method deduction_method not null default 'CASH',
  add column recurring_contribution_amount_kobo bigint check (recurring_contribution_amount_kobo is null or recurring_contribution_amount_kobo > 0),
  add column recurring_contribution_frequency text not null default 'MONTHLY';

-- ============================================================
-- MEMBER DUES — the source of truth for "what's expected this cycle",
-- generated for every active member regardless of deduction method.
-- ============================================================
create table member_dues (
  id                      uuid primary key default extensions.uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  member_id               uuid not null references members(id) on delete cascade,
  due_type                due_type not null,
  loan_id                 uuid references loans(id) on delete cascade,       -- set only when due_type = LOAN_INSTALLMENT
  period_month            int not null check (period_month between 1 and 12),
  period_year             int not null,
  amount_due_kobo         bigint not null check (amount_due_kobo > 0),
  deduction_method        deduction_method not null,                        -- snapshot of the member's method at generation time
  status                  due_status not null default 'OPEN',
  fulfilled_amount_kobo   bigint not null default 0 check (fulfilled_amount_kobo >= 0),
  contribution_id         uuid references contributions(id),
  loan_repayment_id       uuid references loan_repayments(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One due per member/type/loan/period — generation is safely re-runnable.
create unique index idx_member_dues_unique_cycle on member_dues (
  tenant_id, member_id, due_type,
  coalesce(loan_id, '00000000-0000-0000-0000-000000000000'::uuid),
  period_month, period_year
);

create index idx_member_dues_member on member_dues(tenant_id, member_id);
create index idx_member_dues_period on member_dues(tenant_id, period_year, period_month);
create index idx_member_dues_status on member_dues(tenant_id, status);

-- ============================================================
-- PAYROLL BATCHES — a fulfillment run for PAYROLL-deduction members
-- for a given period, packaged for export to HR/payroll.
-- ============================================================
create table payroll_batches (
  id                uuid primary key default extensions.uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  period_month      int not null check (period_month between 1 and 12),
  period_year       int not null,
  status            payroll_batch_status not null default 'DRAFT',
  member_count      int not null default 0,
  total_amount_kobo bigint not null default 0,
  generated_by      uuid references auth.users(id),
  generated_at      timestamptz not null default now(),
  locked_at         timestamptz,
  exported_at       timestamptz,
  unique(tenant_id, period_month, period_year)
);

create index idx_payroll_batches_period on payroll_batches(tenant_id, period_year, period_month);

create table payroll_batch_items (
  id                          uuid primary key default extensions.uuid_generate_v4(),
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  batch_id                    uuid not null references payroll_batches(id) on delete cascade,
  member_id                   uuid not null references members(id) on delete restrict,
  staff_id                    text,
  contribution_amount_kobo    bigint not null default 0,
  loan_installment_amount_kobo bigint not null default 0,
  total_amount_kobo           bigint not null default 0,
  status                      payroll_batch_item_status not null default 'PENDING',
  deducted_amount_kobo        bigint,
  notes                       text,
  created_at                  timestamptz not null default now()
);

create index idx_payroll_batch_items_batch on payroll_batch_items(tenant_id, batch_id);
create index idx_payroll_batch_items_member on payroll_batch_items(tenant_id, member_id);

-- Links a batch line item back to the underlying due(s) it covers —
-- one line item can settle both a contribution due and a loan due.
create table payroll_batch_item_dues (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  batch_item_id uuid not null references payroll_batch_items(id) on delete cascade,
  due_id        uuid not null references member_dues(id) on delete cascade,
  primary key (batch_item_id, due_id)
);

create index idx_payroll_batch_item_dues_due on payroll_batch_item_dues(due_id);

-- ============================================================
-- Gap-fill indexes on existing tables (hot paths for the ledger/statement)
-- ============================================================
create index idx_contributions_period on contributions(tenant_id, period_year, period_month);
create index idx_loan_repayments_tenant_loan on loan_repayments(tenant_id, loan_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Computes the amount due this cycle for an active loan: the same
-- flat-interest formula record_loan_repayment() uses (so a member who
-- pays exactly this figure fully covers the cycle's real interest),
-- plus a straight-line principal component over the loan's remaining
-- tenure. This is the v1 default amortization method — a per-loan
-- override is out of scope for this pass.
create or replace function compute_loan_installment_due(p_loan_id uuid)
returns bigint
language plpgsql
stable
as $$
declare
  v_loan              record;
  v_outstanding       bigint;
  v_interest_due      bigint;
  v_months_elapsed    int;
  v_remaining_months  int;
  v_principal_due     bigint;
begin
  select * into v_loan from loans where id = p_loan_id;
  if not found or v_loan.status <> 'ACTIVE' then
    return 0;
  end if;

  v_outstanding := v_loan.principal_kobo
    + coalesce((select sum(amount_kobo) from loan_topup_requests where loan_id = p_loan_id and status = 'APPROVED'), 0)
    - coalesce((select sum(principal_portion_kobo) from loan_repayments where loan_id = p_loan_id), 0);

  if v_outstanding <= 0 then
    return 0;
  end if;

  v_interest_due := round(v_outstanding * v_loan.interest_rate_bps / 10000.0 / 12);

  v_months_elapsed := greatest(0, (
    extract(year from age(now(), coalesce(v_loan.disbursed_at, now()))) * 12
    + extract(month from age(now(), coalesce(v_loan.disbursed_at, now())))
  )::int);
  v_remaining_months := greatest(v_loan.tenure_months - v_months_elapsed, 1);
  v_principal_due := round(v_outstanding::numeric / v_remaining_months);

  return v_principal_due + v_interest_due;
end;
$$;

-- Generates member_dues rows for a period, for every active member with
-- a recurring contribution amount and every active loan — regardless of
-- deduction method. Set-based (no per-member looping, no external chunking
-- needed — Postgres processes the whole tenant in one query plan) and
-- idempotent: re-running the same period only fills in rows that don't
-- exist yet. Callable directly by an authenticated cooperative admin, same
-- pattern as record_loan_repayment() below.
create or replace function generate_member_dues(p_period_month int, p_period_year int)
returns int
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_contrib_count int := 0;
  v_loan_count    int := 0;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  insert into member_dues (tenant_id, member_id, due_type, period_month, period_year, amount_due_kobo, deduction_method)
  select m.tenant_id, m.id, 'CONTRIBUTION', p_period_month, p_period_year, m.recurring_contribution_amount_kobo, m.deduction_method
  from members m
  where m.tenant_id = v_tenant_id
    and m.status = 'ACTIVE'
    and m.recurring_contribution_amount_kobo is not null
  on conflict do nothing;

  get diagnostics v_contrib_count = row_count;

  insert into member_dues (tenant_id, member_id, due_type, loan_id, period_month, period_year, amount_due_kobo, deduction_method)
  select l.tenant_id, l.member_id, 'LOAN_INSTALLMENT', l.id, p_period_month, p_period_year,
         compute_loan_installment_due(l.id), m.deduction_method
  from loans l
  join members m on m.id = l.member_id
  where l.tenant_id = v_tenant_id
    and l.status = 'ACTIVE'
    and compute_loan_installment_due(l.id) > 0
  on conflict do nothing;

  get diagnostics v_loan_count = row_count;

  return v_contrib_count + v_loan_count;
end;
$$;

-- Packages OPEN dues for this tenant's PAYROLL-deduction members into a
-- batch for the given period — one set-based aggregation query, not a loop.
-- Postgres itself processes every member in a single query plan regardless
-- of how many thousand there are, so there's no need for the caller to
-- chunk this into pages the way an external service would have to.
create or replace function generate_payroll_batch(p_period_month int, p_period_year int)
returns table (id uuid, period_month int, period_year int, status payroll_batch_status, member_count int, total_amount_kobo bigint)
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_batch_id uuid;
  v_member_count int;
  v_total_kobo bigint;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  if exists (select 1 from payroll_batches where tenant_id = v_tenant_id and period_month = p_period_month and period_year = p_period_year) then
    raise exception 'A batch for this period already exists';
  end if;

  insert into payroll_batches (tenant_id, period_month, period_year, status, generated_by)
  values (v_tenant_id, p_period_month, p_period_year, 'DRAFT', auth.uid())
  returning payroll_batches.id into v_batch_id;

  -- one line item per PAYROLL member with any OPEN due this period
  insert into payroll_batch_items (tenant_id, batch_id, member_id, staff_id, contribution_amount_kobo, loan_installment_amount_kobo, total_amount_kobo)
  select
    v_tenant_id, v_batch_id, m.id, m.staff_id,
    coalesce(sum(d.amount_due_kobo) filter (where d.due_type = 'CONTRIBUTION'), 0),
    coalesce(sum(d.amount_due_kobo) filter (where d.due_type = 'LOAN_INSTALLMENT'), 0),
    coalesce(sum(d.amount_due_kobo), 0)
  from members m
  join member_dues d on d.member_id = m.id and d.tenant_id = v_tenant_id and d.period_month = p_period_month and d.period_year = p_period_year and d.status = 'OPEN'
  where m.tenant_id = v_tenant_id and m.deduction_method = 'PAYROLL' and m.status = 'ACTIVE'
  group by m.id, m.staff_id;

  -- link each line item back to the due row(s) it covers
  insert into payroll_batch_item_dues (tenant_id, batch_item_id, due_id)
  select v_tenant_id, pbi.id, d.id
  from payroll_batch_items pbi
  join member_dues d on d.member_id = pbi.member_id and d.tenant_id = v_tenant_id and d.period_month = p_period_month and d.period_year = p_period_year and d.status = 'OPEN'
  where pbi.batch_id = v_batch_id;

  select count(*), coalesce(sum(pbi.total_amount_kobo), 0) into v_member_count, v_total_kobo
  from payroll_batch_items pbi where pbi.batch_id = v_batch_id;

  update payroll_batches set member_count = v_member_count, total_amount_kobo = v_total_kobo where payroll_batches.id = v_batch_id;

  return query select v_batch_id, p_period_month, p_period_year, 'DRAFT'::payroll_batch_status, v_member_count, v_total_kobo;
end;
$$;

-- Records HR's actual outcome for one payroll line item and posts the
-- matching contribution/loan-repayment rows atomically, so a failure
-- partway through can't leave the item marked reconciled without the
-- money actually landing in the ledger.
create or replace function reconcile_payroll_item(p_item_id uuid, p_status payroll_batch_item_status, p_deducted_amount_kobo bigint)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_item record;
  v_batch record;
  v_loan_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_item from payroll_batch_items where id = p_item_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'batch item not found';
  end if;

  select * into v_batch from payroll_batches where id = v_item.batch_id;

  if p_status in ('DEDUCTED', 'PARTIAL') then
    if v_item.contribution_amount_kobo > 0 then
      insert into contributions (tenant_id, member_id, amount_kobo, channel, status, reference, period_month, period_year, completed_at)
      select v_tenant_id, v_item.member_id,
             least(v_item.contribution_amount_kobo, coalesce(p_deducted_amount_kobo, v_item.contribution_amount_kobo)),
             'payroll', 'COMPLETED', 'PAYROLL-' || p_item_id || '-CONTRIB', v_batch.period_month, v_batch.period_year, now()
      on conflict (reference) do nothing;
    end if;

    if v_item.loan_installment_amount_kobo > 0 then
      select d.loan_id into v_loan_id
      from payroll_batch_item_dues pbid
      join member_dues d on d.id = pbid.due_id
      where pbid.batch_item_id = p_item_id and d.loan_id is not null
      limit 1;

      if v_loan_id is not null and not exists (select 1 from loan_repayments where reference = 'PAYROLL-' || p_item_id || '-LOAN') then
        -- pass the batch's own period as the payment date (not now()), so
        -- fulfill_loan_due's period match stays correct even if HR reconciles
        -- a batch after the month it covers has ended
        perform record_loan_repayment(
          v_loan_id,
          least(v_item.loan_installment_amount_kobo, coalesce(p_deducted_amount_kobo, v_item.loan_installment_amount_kobo)),
          'payroll', make_date(v_batch.period_year, v_batch.period_month, 1)::timestamptz, 'PAYROLL-' || p_item_id || '-LOAN'
        );
      end if;
    end if;
  end if;

  update payroll_batch_items
  set status = p_status, deducted_amount_kobo = coalesce(p_deducted_amount_kobo, 0)
  where id = p_item_id;
end;
$$;

-- Best-effort: marks a matching OPEN member_dues row as fulfilled when a
-- loan repayment is posted, so the admin ledger and member statement show
-- it regardless of which channel (payroll, cash, bank transfer) paid it.
-- Extends record_loan_repayment() rather than duplicating this logic in
-- application code, so it fires no matter which caller posts a repayment.
create or replace function fulfill_loan_due(p_loan_id uuid, p_repayment_id uuid, p_amount_kobo bigint, p_paid_at timestamptz)
returns void
language plpgsql
as $$
declare
  v_due record;
begin
  select * into v_due from member_dues
  where loan_id = p_loan_id
    and due_type = 'LOAN_INSTALLMENT'
    and status = 'OPEN'
    and period_month = extract(month from p_paid_at)
    and period_year = extract(year from p_paid_at)
  limit 1;

  if not found then
    return;
  end if;

  update member_dues
  set status = case when p_amount_kobo >= amount_due_kobo then 'FULFILLED' else 'PARTIAL' end,
      fulfilled_amount_kobo = p_amount_kobo,
      loan_repayment_id = p_repayment_id,
      updated_at = now()
  where id = v_due.id;
end;
$$;

create or replace function fulfill_contribution_due(p_member_id uuid, p_contribution_id uuid, p_amount_kobo bigint, p_period_month int, p_period_year int)
returns void
language plpgsql
as $$
declare
  v_due record;
begin
  select * into v_due from member_dues
  where member_id = p_member_id
    and due_type = 'CONTRIBUTION'
    and status = 'OPEN'
    and period_month = p_period_month
    and period_year = p_period_year
  limit 1;

  if not found then
    return;
  end if;

  update member_dues
  set status = case when p_amount_kobo >= amount_due_kobo then 'FULFILLED' else 'PARTIAL' end,
      fulfilled_amount_kobo = p_amount_kobo,
      contribution_id = p_contribution_id,
      updated_at = now()
  where id = v_due.id;
end;
$$;

-- Wire the two hooks above into the existing posting paths, so this works
-- no matter which surface (today's browser-direct admin calls, or a future
-- Worker route) posts the payment — one authoritative place, not duplicated
-- application-side logic.
create or replace function record_loan_repayment(
  p_loan_id uuid, p_amount_kobo bigint, p_channel text, p_paid_at timestamptz, p_reference text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_loan record;
  v_outstanding bigint;
  v_interest_due bigint;
  v_interest_portion bigint;
  v_principal_portion bigint;
  v_repayment_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_loan from loans where id = p_loan_id and tenant_id = v_tenant_id for update;
  if not found then
    raise exception 'loan not found';
  end if;

  v_outstanding := v_loan.principal_kobo
    + coalesce((select sum(amount_kobo) from loan_topup_requests where loan_id = p_loan_id and status = 'APPROVED'), 0)
    - coalesce((select sum(principal_portion_kobo) from loan_repayments where loan_id = p_loan_id), 0);

  v_interest_due := round(v_outstanding * v_loan.interest_rate_bps / 10000.0 / 12);
  v_interest_portion := least(p_amount_kobo, v_interest_due);
  v_principal_portion := p_amount_kobo - v_interest_portion;

  insert into loan_repayments (
    tenant_id, loan_id, amount_kobo, principal_portion_kobo, interest_portion_kobo, channel, reference, paid_at
  ) values (
    v_tenant_id, p_loan_id, p_amount_kobo, v_principal_portion, v_interest_portion, p_channel, p_reference, p_paid_at
  ) returning id into v_repayment_id;

  if v_principal_portion >= v_outstanding then
    update loans set status = 'REPAID', updated_at = now() where id = p_loan_id;
  end if;

  perform fulfill_loan_due(p_loan_id, v_repayment_id, p_amount_kobo, p_paid_at);

  return v_repayment_id;
end;
$$;

-- Contributions have no equivalent RPC (they're inserted directly then
-- transitioned PENDING -> COMPLETED), so the hook is a trigger instead.
-- SECURITY DEFINER so this keeps working regardless of which role performs
-- the triggering statement — an authenticated cooperative admin session.
create or replace function trg_fulfill_contribution_due()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'COMPLETED' and (old.status is distinct from 'COMPLETED') and new.period_month is not null and new.period_year is not null then
    perform fulfill_contribution_due(new.member_id, new.id, new.amount_kobo, new.period_month, new.period_year);
  end if;
  return new;
end;
$$;

create or replace function trg_fulfill_contribution_due_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'COMPLETED' and new.period_month is not null and new.period_year is not null then
    perform fulfill_contribution_due(new.member_id, new.id, new.amount_kobo, new.period_month, new.period_year);
  end if;
  return new;
end;
$$;

create trigger contributions_fulfill_due_on_update
  after update on contributions
  for each row execute function trg_fulfill_contribution_due();

-- Payroll reconciliation inserts a contribution as COMPLETED directly
-- (no PENDING -> COMPLETED transition), so an update-only trigger would
-- miss it — cover the insert path too.
create trigger contributions_fulfill_due_on_insert
  after insert on contributions
  for each row execute function trg_fulfill_contribution_due_insert();

-- Member-facing aggregate for the self-service Statement page. Runs with
-- the CALLER's own privileges (not security definer) so it's scoped
-- entirely by the existing members/contributions/loans/loan_repayments
-- self-select RLS policies — no new access-control surface to get wrong.
create or replace function get_member_statement_summary()
returns table (
  member_id                 uuid,
  total_contributions_kobo  bigint,
  contribution_count        int,
  active_loan_count         int,
  total_principal_kobo      bigint,
  total_repaid_kobo         bigint,
  total_outstanding_kobo    bigint
)
language sql
stable
as $$
  with me as (
    select id from members where auth_user_id = auth.uid()
  ),
  contrib as (
    select coalesce(sum(amount_kobo), 0) as total, count(*)::int as cnt
    from contributions
    where member_id = (select id from me) and status = 'COMPLETED'
  ),
  loan_agg as (
    select
      count(*) filter (where status = 'ACTIVE')::int as active_count,
      coalesce(sum(principal_kobo) filter (where status in ('ACTIVE', 'REPAID')), 0) as total_principal
    from loans
    where member_id = (select id from me)
  ),
  repay as (
    select coalesce(sum(lr.principal_portion_kobo), 0) as total_repaid
    from loan_repayments lr
    join loans l on l.id = lr.loan_id
    where l.member_id = (select id from me)
  )
  select
    (select id from me),
    contrib.total, contrib.cnt,
    loan_agg.active_count, loan_agg.total_principal,
    repay.total_repaid,
    loan_agg.total_principal - repay.total_repaid
  from contrib, loan_agg, repay;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table member_dues enable row level security;
alter table payroll_batches enable row level security;
alter table payroll_batch_items enable row level security;
alter table payroll_batch_item_dues enable row level security;

create policy "member_dues_isolated" on member_dues
  for all using (tenant_id = get_tenant_id());

create policy "member_dues_self_select" on member_dues
  for select using (
    member_id in (select id from members where auth_user_id = auth.uid())
  );

create policy "payroll_batches_isolated" on payroll_batches
  for all using (tenant_id = get_tenant_id());

create policy "payroll_batch_items_isolated" on payroll_batch_items
  for all using (tenant_id = get_tenant_id());

create policy "payroll_batch_item_dues_isolated" on payroll_batch_item_dues
  for all using (tenant_id = get_tenant_id());
