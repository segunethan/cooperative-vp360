-- generate_payroll_batch refused to run a second time for any period that
-- already had a batch, even an empty DRAFT one. In practice an admin often
-- generates a batch before any member is actually configured for payroll
-- (or before dues exist yet), gets zero line items, then has no way to
-- regenerate it once they've fixed that — "A batch for this period already
-- exists" with no escape hatch. A DRAFT batch hasn't been locked or sent to
-- HR yet, so it's safe to regenerate freely; only a LOCKED/EXPORTED/
-- RECONCILED batch should stay protected from being silently rebuilt.
create or replace function generate_payroll_batch(p_period_month int, p_period_year int)
returns table (id uuid, period_month int, period_year int, status payroll_batch_status, member_count int, total_amount_kobo bigint)
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_batch_id uuid;
  v_existing_status payroll_batch_status;
  v_member_count int;
  v_total_kobo bigint;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select pb.id, pb.status into v_batch_id, v_existing_status
  from payroll_batches pb
  where pb.tenant_id = v_tenant_id and pb.period_month = p_period_month and pb.period_year = p_period_year;

  if found then
    if v_existing_status <> 'DRAFT' then
      raise exception 'A % batch for this period already exists and can no longer be regenerated', v_existing_status;
    end if;

    -- regenerate in place: clear the old line items and rebuild from
    -- whatever OPEN dues exist right now
    delete from payroll_batch_item_dues
    where batch_item_id in (select id from payroll_batch_items where batch_id = v_batch_id);
    delete from payroll_batch_items where batch_id = v_batch_id;
  else
    insert into payroll_batches (tenant_id, period_month, period_year, status, generated_by)
    values (v_tenant_id, p_period_month, p_period_year, 'DRAFT', auth.uid())
    returning payroll_batches.id into v_batch_id;
  end if;

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

  update payroll_batches
  set member_count = v_member_count, total_amount_kobo = v_total_kobo, generated_by = auth.uid(), generated_at = now()
  where payroll_batches.id = v_batch_id;

  return query select v_batch_id, p_period_month, p_period_year, 'DRAFT'::payroll_batch_status, v_member_count, v_total_kobo;
end;
$$;
