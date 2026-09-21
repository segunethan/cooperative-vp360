-- ============================================================
-- PUBLIC MEMBERSHIP APPLICATIONS
-- ============================================================

create type application_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create table member_applications (
  id                uuid primary key default extensions.uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  full_name         text not null,
  email             text not null,
  phone             text,
  about             text,
  status            application_status not null default 'PENDING',
  rejection_reason  text,
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  submitted_at      timestamptz not null default now()
);

create index idx_member_applications_tenant on member_applications(tenant_id, status);

alter table member_applications enable row level security;

create policy "member_applications_isolated" on member_applications
  for select using (tenant_id = get_tenant_id());

create policy "member_applications_update" on member_applications
  for update using (tenant_id = get_tenant_id());

-- Public: anyone can submit an application, no account required. Nothing
-- sensitive is written, and the tenant_id foreign key rejects garbage ids.
create policy "member_applications_public_insert" on member_applications
  for insert with check (true);

-- Public lookup for the /apply/:slug page — exposes only safe, non-sensitive
-- fields (never raw table access, so email/rc_number/billing stay private).
create or replace function get_tenant_public_info(p_slug text)
returns table (id uuid, name text, logo_url text)
language sql
security definer
stable
as $$
  select id, name, logo_url from tenants
  where slug = p_slug and status = 'ACTIVE';
$$;

-- ============================================================
-- MEMBERSHIP ONBOARDING: entrance fee + expanded KYC fields
-- ============================================================

alter table tenants
  add column entrance_fee_kobo bigint;

-- Members previously had no way to read their own cooperative's row at all
-- (tenants only had an admin-scoped policy) — needed so the onboarding wizard
-- can show the entrance fee, and fixes a latent bug where the member portal's
-- "cooperative name" join silently resolved to null for every member.
create policy "tenants_member_select" on tenants
  for select using (id in (select tenant_id from members where auth_user_id = auth.uid()));

alter table member_kyc_submissions
  add column nin text,
  add column id_document_url text,
  add column not_in_other_society boolean not null default false,
  add column existing_debt_declaration text,
  add column monthly_thrift_kobo bigint,
  add column entrance_fee_kobo bigint,
  add column entrance_fee_receipt_url text,
  add column entrance_fee_paid_date date,
  add column signature_name text,
  add column endorsed_at timestamptz;
