-- ============================================================
-- BANKS MASTER DATA
--
-- Preloaded reference data so every form that currently takes a free-text
-- "bank name" (KYC, withdrawal requests, and any future one) can offer a
-- select instead — members mistyping "GTBank" as "GT bank" / "Gtb" etc. has
-- been a real usability problem. Global, not tenant-scoped: these are real
-- Nigerian banks, not cooperative-specific configuration. Read-only from the
-- client — nobody mutates this table outside a migration.
-- ============================================================
create table banks (
  id          uuid primary key default extensions.uuid_generate_v4(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

alter table banks enable row level security;

create policy "banks_select_all" on banks
  for select using (true);

insert into banks (name) values
  ('Access Bank'),
  ('Citibank Nigeria'),
  ('Ecobank Nigeria'),
  ('Fidelity Bank'),
  ('First Bank of Nigeria'),
  ('First City Monument Bank (FCMB)'),
  ('Globus Bank'),
  ('Guaranty Trust Bank (GTBank)'),
  ('Heritage Bank'),
  ('Jaiz Bank'),
  ('Keystone Bank'),
  ('Kuda Microfinance Bank'),
  ('Moniepoint Microfinance Bank'),
  ('Opay (Paycom)'),
  ('Optimus Bank'),
  ('PalmPay'),
  ('Parallex Bank'),
  ('Polaris Bank'),
  ('PremiumTrust Bank'),
  ('Providus Bank'),
  ('Rubies Microfinance Bank'),
  ('Signature Bank'),
  ('Stanbic IBTC Bank'),
  ('Standard Chartered Bank'),
  ('Sterling Bank'),
  ('SunTrust Bank'),
  ('Titan Trust Bank'),
  ('Union Bank of Nigeria'),
  ('United Bank for Africa (UBA)'),
  ('Unity Bank'),
  ('VFD Microfinance Bank'),
  ('Wema Bank'),
  ('Zenith Bank');

-- ============================================================
-- CONTRIBUTION WITHDRAWALS — opt-in per cooperative, same pattern as
-- payroll_enabled. A member requests a withdrawal from their contribution
-- balance; the admin approves (authorizing it, checked against the balance
-- at that moment) and later marks it paid once they've actually sent the
-- money out by bank transfer. Two steps rather than one because — unlike a
-- loan top-up or repayment request, where the member's money already
-- arrived before the admin reviews it — here the money hasn't left the
-- cooperative's account yet at approval time, so the balance should only
-- drop once it's actually been paid out, not the moment it's authorized.
-- ============================================================
alter table tenants
  add column withdrawals_enabled boolean not null default false;

create type withdrawal_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

create table withdrawal_requests (
  id                uuid primary key default extensions.uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  member_id         uuid not null references members(id) on delete cascade,
  amount_kobo       bigint not null check (amount_kobo > 0),
  reason            text not null,
  bank_name         text not null,
  account_number    text not null,
  account_name      text not null,
  status            withdrawal_status not null default 'PENDING',
  requested_at      timestamptz not null default now(),
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  rejection_reason  text,
  paid_at           timestamptz,
  payment_reference text
);

create index idx_withdrawal_requests_tenant_status on withdrawal_requests(tenant_id, status);
create index idx_withdrawal_requests_member on withdrawal_requests(tenant_id, member_id);

alter table withdrawal_requests enable row level security;

create policy "withdrawal_requests_isolated" on withdrawal_requests
  for all using (tenant_id = get_tenant_id());

create policy "withdrawal_requests_self_select" on withdrawal_requests
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "withdrawal_requests_self_insert" on withdrawal_requests
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
  );

-- A member's contribution balance = completed contributions minus whatever
-- has actually been paid out (PAID, not merely APPROVED — see above).
-- Shared by the review function below so approval can't authorize more than
-- the member actually has.
create or replace function get_member_contribution_balance(p_member_id uuid)
returns bigint
language sql
stable
as $$
  select
    coalesce((select sum(amount_kobo) from contributions where member_id = p_member_id and status = 'COMPLETED'), 0)
    - coalesce((select sum(amount_kobo) from withdrawal_requests where member_id = p_member_id and status = 'PAID'), 0);
$$;

create or replace function review_withdrawal_request(
  p_request_id uuid, p_approve boolean, p_reviewer uuid, p_rejection_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_request record;
  v_balance bigint;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_request from withdrawal_requests
  where id = p_request_id and tenant_id = v_tenant_id and status = 'PENDING'
  for update;

  if not found then
    raise exception 'withdrawal request not found or already reviewed';
  end if;

  if p_approve then
    v_balance := get_member_contribution_balance(v_request.member_id);
    if v_request.amount_kobo > v_balance then
      raise exception 'requested amount (%) exceeds the member''s current contribution balance (%)', v_request.amount_kobo, v_balance;
    end if;

    update withdrawal_requests
    set status = 'APPROVED', reviewed_by = p_reviewer, reviewed_at = now()
    where id = p_request_id;
  else
    update withdrawal_requests
    set status = 'REJECTED', reviewed_by = p_reviewer, reviewed_at = now(), rejection_reason = p_rejection_reason
    where id = p_request_id;
  end if;
end;
$$;

-- Separate step: the admin has actually sent the money by bank transfer.
-- Only now does the member's displayed balance drop.
create or replace function mark_withdrawal_paid(p_request_id uuid, p_payment_reference text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  update withdrawal_requests
  set status = 'PAID', paid_at = now(), payment_reference = p_payment_reference
  where id = p_request_id and tenant_id = v_tenant_id and status = 'APPROVED';

  if not found then
    raise exception 'withdrawal request not found or not yet approved';
  end if;
end;
$$;
