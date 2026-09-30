-- ============================================================
-- Loan Types (admin-configured loan catalog) + Announcements fix
--
-- 1. Loan types: today a member applying for a loan (or an admin applying
--    on their behalf) picks from a hardcoded 3-item array duplicated in two
--    different frontend files, with a "Custom" escape hatch that lets
--    anyone type an arbitrary rate/tenure. This introduces a real
--    tenant-scoped catalog (mirrors the existing `products` table pattern)
--    so admins configure the loan types their cooperative actually offers
--    (name, interest rate, tenure), and members can only apply from that
--    list. A trigger derives loans.interest_rate_bps/tenure_months from the
--    chosen loan_type at insert time, so a tampered client request can't
--    apply off-catalog terms even if it forges a rate in the request body.
--
-- 2. Announcements: the announcements table was created with a `body`
--    column and no `category`/`status` columns, but the admin UI and API
--    layer (packages/shared/lib/api/announcements.ts) were written against
--    `content`/`category`/`status` — every publish/draft-save call has been
--    failing with a "column does not exist" error since the UI shipped.
--    This renames body -> content and adds the two missing columns so the
--    already-built UI starts working, with no code changes needed there.
-- ============================================================

-- ============================================================
-- LOAN TYPES
-- ============================================================
create type loan_type_status as enum ('ACTIVE', 'ARCHIVED');

create table loan_types (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  description         text,
  interest_rate_bps   int not null check (interest_rate_bps >= 0),
  tenure_months       int not null check (tenure_months > 0),
  status              loan_type_status not null default 'ACTIVE',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_loan_types_tenant on loan_types(tenant_id, status);

alter table loan_types enable row level security;

create policy "loan_types_isolated" on loan_types
  for all using (tenant_id = get_tenant_id());

create policy "loan_types_member_select" on loan_types
  for select using (
    tenant_id in (select tenant_id from members where auth_user_id = auth.uid())
    and status = 'ACTIVE'
  );

-- Links an application back to the catalog entry it was submitted under.
-- Nullable: existing loans predate this and have nothing meaningful to
-- backfill; on delete set null so archiving/removing a loan type never
-- breaks a historical loan record.
alter table loans add column loan_type_id uuid references loan_types(id) on delete set null;

-- Enforces the catalog server-side: whatever rate/tenure a client sends is
-- overwritten from the chosen loan type, so applying "off-catalog" terms
-- isn't possible even by calling the insert directly with a forged payload.
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
  end if;
  return new;
end;
$$;

create trigger loans_apply_loan_type_terms
  before insert on loans
  for each row execute function trg_apply_loan_type_terms();

-- ============================================================
-- ANNOUNCEMENTS FIX
-- ============================================================
create type announcement_status as enum ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

alter table announcements rename column body to content;

alter table announcements
  add column category text not null default 'general'
    check (category in ('agm', 'product', 'system', 'general', 'event')),
  add column status announcement_status not null default 'DRAFT';

-- Backfill: any pre-existing row (there likely are none, since every insert
-- was failing) with a published_at timestamp is a published announcement.
update announcements set status = 'PUBLISHED' where published_at is not null;

create index idx_announcements_tenant_status on announcements(tenant_id, status, published_at desc);
