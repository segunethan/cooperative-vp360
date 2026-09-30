-- ============================================================
-- Loan Repayment Requests (member self-service)
--
-- Today only an admin can record a loan repayment (Loans.tsx "Record
-- Repayment" -> record_loan_repayment() RPC) — there is no way for a member
-- to report a repayment they made themselves. This mirrors the existing
-- loan_topup_requests pattern exactly: the member submits a request
-- (amount, channel, date paid), it sits PENDING, and an admin approves or
-- rejects it. Approval calls the existing record_loan_repayment() — the
-- same interest/principal split, REPAID flip, and member_dues fulfillment
-- hook a manually-recorded repayment already gets — so nothing about how a
-- repayment is actually posted changes; this only adds a review step in
-- front of it for member-submitted ones.
-- ============================================================

create table loan_repayment_requests (
  id            uuid primary key default extensions.uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  loan_id       uuid not null references loans(id) on delete cascade,
  member_id     uuid not null references members(id) on delete restrict,
  amount_kobo   bigint not null check (amount_kobo > 0),
  channel       text not null default 'bank_transfer',
  paid_at       timestamptz not null,
  notes         text,
  status        request_status not null default 'PENDING',
  requested_at  timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  loan_repayment_id uuid references loan_repayments(id)
);

create index idx_loan_repayment_requests_loan on loan_repayment_requests(tenant_id, loan_id);
create index idx_loan_repayment_requests_status on loan_repayment_requests(tenant_id, status);

alter table loan_repayment_requests enable row level security;

create policy "loan_repayment_requests_isolated" on loan_repayment_requests
  for all using (tenant_id = get_tenant_id());

create policy "loan_repayment_requests_self_select" on loan_repayment_requests
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "loan_repayment_requests_self_insert" on loan_repayment_requests
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
    and loan_id in (
      select id from loans
      where member_id in (select id from members where auth_user_id = auth.uid())
        and status = 'ACTIVE'
    )
  );

-- Approve/reject a member-submitted repayment request. On approve, posts
-- the actual repayment through record_loan_repayment() (same function the
-- admin's own "Record Repayment" dialog uses), so it fully participates in
-- the loan ledger, due-fulfillment, and REPAID-status logic already built.
create or replace function review_loan_repayment_request(p_request_id uuid, p_approve boolean, p_reviewer uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_request record;
  v_repayment_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_request from loan_repayment_requests
  where id = p_request_id and tenant_id = v_tenant_id and status = 'PENDING'
  for update;

  if not found then
    raise exception 'request not found or already reviewed';
  end if;

  if p_approve then
    v_repayment_id := record_loan_repayment(
      v_request.loan_id, v_request.amount_kobo, v_request.channel, v_request.paid_at,
      'MEMBER-REPAY-' || p_request_id
    );
  end if;

  update loan_repayment_requests
  set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
      reviewed_by = p_reviewer,
      reviewed_at = now(),
      loan_repayment_id = v_repayment_id
  where id = p_request_id;
end;
$$;
