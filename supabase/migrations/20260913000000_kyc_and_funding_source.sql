-- ============================================================
-- KYC SUBMISSIONS + PAYMENT-VERIFIED PRODUCT FUNDING
-- ============================================================

create type kyc_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type kyc_id_type as enum ('NIN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD');
create type funding_source as enum ('EXTERNAL_PAYMENT', 'CONTRIBUTION_TRANSFER');

-- ============================================================
-- MEMBER KYC SUBMISSIONS (one row per member, upsert on resubmit)
-- ============================================================
create table member_kyc_submissions (
  id                      uuid primary key default extensions.uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  member_id               uuid not null references members(id) on delete cascade,
  bank_name               text not null,
  account_number          text not null,
  account_name            text not null,
  bvn                     text not null,
  secret_question         text not null,
  secret_answer           text not null,
  id_type                 kyc_id_type not null,
  id_number               text not null,
  id_expiry_date          date not null,
  next_of_kin_name        text not null,
  next_of_kin_relationship text not null,
  next_of_kin_phone       text not null,
  next_of_kin_address     text not null,
  status                  kyc_status not null default 'PENDING',
  rejection_reason        text,
  reviewed_by             uuid references auth.users(id),
  reviewed_at             timestamptz,
  submitted_at            timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(tenant_id, member_id)
);

create index idx_member_kyc_submissions_tenant on member_kyc_submissions(tenant_id, status);

alter table member_kyc_submissions enable row level security;

create policy "member_kyc_submissions_isolated" on member_kyc_submissions
  for all using (tenant_id = get_tenant_id());

create policy "member_kyc_submissions_self_select" on member_kyc_submissions
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "member_kyc_submissions_self_insert" on member_kyc_submissions
  for insert with check (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "member_kyc_submissions_self_update" on member_kyc_submissions
  for update using (
    member_id in (select id from members where auth_user_id = auth.uid())
    and status in ('PENDING', 'REJECTED')
  );

-- Approve/reject a KYC submission; approving also flips members.kyc_verified.
create or replace function review_kyc_submission(
  p_submission_id uuid, p_approve boolean, p_reviewer uuid, p_rejection_reason text
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_member_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select member_id into v_member_id from member_kyc_submissions
  where id = p_submission_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  update member_kyc_submissions
  set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
      rejection_reason = case when p_approve then null else p_rejection_reason end,
      reviewed_by = p_reviewer,
      reviewed_at = now(),
      updated_at = now()
  where id = p_submission_id;

  if p_approve then
    update members
    set kyc_verified = true, kyc_verified_at = now(), updated_at = now()
    where id = v_member_id;
  end if;
end;
$$;

-- ============================================================
-- PAYMENT-VERIFIED FUNDING for product subscriptions/requests
-- ============================================================
-- Backfill existing rows as CONTRIBUTION_TRANSFER (no receipt required) so the
-- check constraint below doesn't reject pre-existing test subscriptions that
-- predate this column; new rows must explicitly pick a funding source.
alter table product_subscriptions
  add column funding_source funding_source not null default 'CONTRIBUTION_TRANSFER',
  add column receipt_url text,
  add constraint product_subscriptions_funding_check check (
    (funding_source = 'EXTERNAL_PAYMENT' and receipt_url is not null)
    or funding_source = 'CONTRIBUTION_TRANSFER'
  );

alter table product_subscriptions alter column funding_source drop default;

alter table product_subscription_requests
  add column funding_source funding_source,
  add column receipt_url text,
  add constraint product_subscription_requests_funding_check check (
    request_type = 'WITHDRAWAL'
    or (funding_source = 'EXTERNAL_PAYMENT' and receipt_url is not null)
    or funding_source = 'CONTRIBUTION_TRANSFER'
  );
