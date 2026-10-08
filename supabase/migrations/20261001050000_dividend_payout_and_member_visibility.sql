-- Two real gaps in dividends:
--
-- 1. There was no way to actually mark a declared dividend as paid.
--    declareDividend() always inserts with status='DECLARED' and every
--    entitlement's paid_at stays null forever — nothing in the app ever
--    transitions either. The dashboard's "Dividends Paid" card and the
--    Dividends page's own "Total Paid Out" card both filter on
--    status/paid_at = COMPLETED, so a declared dividend can never show up
--    as paid anywhere, no matter what the admin does in the UI.
--
-- 2. Members had zero visibility into dividends: no RLS policy let a member
--    read their own dividends/dividend_entitlements rows, and nothing in
--    the member app queried them even if it could.
--
-- This migration adds the missing self-select policies and a
-- mark_dividend_paid() RPC that pays out every unpaid entitlement on a
-- dividend in one step (bulk bank transfer is how this actually happens —
-- same reasoning as payroll reconciliation and withdrawal payout elsewhere
-- in this schema).

create policy "dividends_self_select" on dividends
  for select using (tenant_id in (select tenant_id from members where auth_user_id = auth.uid()));

create policy "dividend_entitlements_self_select" on dividend_entitlements
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create or replace function mark_dividend_paid(p_dividend_id uuid, p_reference text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_dividend record;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_dividend from dividends where id = p_dividend_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'dividend not found';
  end if;
  if v_dividend.status = 'COMPLETED' then
    raise exception 'this dividend has already been marked as paid';
  end if;

  update dividend_entitlements
  set paid_at = now(),
      paystack_reference = coalesce(p_reference, paystack_reference),
      payment_method = coalesce(payment_method, 'bank_transfer')
  where dividend_id = p_dividend_id and paid_at is null;

  update dividends set status = 'COMPLETED' where id = p_dividend_id;
end;
$$;
