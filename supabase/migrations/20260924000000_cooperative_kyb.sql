-- Cooperative-level KYB (Know Your Business): a short business-verification
-- step every cooperative must complete and have the platform approve before
-- they can invite their first member. Reuses the dormant tenant_status
-- states (KYB_SUBMITTED -> ACTIVE) that existed in the schema but were
-- never actually written by any code path.

alter type tenant_status add value if not exists 'KYB_REJECTED';

alter table tenants
  add column if not exists cac_certificate_url text,
  add column if not exists authorized_signatory_name text,
  add column if not exists kyb_submitted_at timestamptz,
  add column if not exists kyb_reviewed_at timestamptz,
  add column if not exists kyb_reviewed_by uuid references auth.users(id),
  add column if not exists kyb_rejection_reason text;

-- Storage bucket for CAC certificate uploads. Public (same convention as the
-- existing contribution-receipts bucket, which getPublicUrl() relies on),
-- with a permissive authenticated-write policy since only a signed-in
-- cooperative admin ever calls submitKyb().
insert into storage.buckets (id, name, public)
values ('kyb-documents', 'kyb-documents', true)
on conflict (id) do nothing;

create policy "kyb_documents_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'kyb-documents');

create policy "kyb_documents_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'kyb-documents');
