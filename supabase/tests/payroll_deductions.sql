-- Manual verification script for the payroll deductions migration
-- (20260930000000_payroll_deductions.sql). This repo has no pgTAP/test
-- harness set up yet, so this is a plain SQL script with RAISE EXCEPTION
-- assertions — run it against a local instance, not production:
--
--   supabase start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f supabase/tests/payroll_deductions.sql
--
-- generate_member_dues / generate_payroll_batch / reconcile_payroll_item are
-- all gated on get_tenant_id() (same pattern as the existing
-- record_loan_repayment), so this script simulates a real authenticated
-- admin session — via the request.jwt.claims GUC and the `authenticated`
-- role — rather than relying on postgres-superuser bypass. This exercises
-- the same auth path a real admin browser session goes through.
--
-- Everything is wrapped in a transaction that rolls back at the end, so it
-- never leaves test data behind.

begin;

do $$
declare
  v_admin_user_id uuid := extensions.uuid_generate_v4();
  v_tenant_id uuid;
  v_member_id uuid;
  v_loan_id uuid;
  v_installment bigint;
  v_due_count int;
  v_batch record;
begin
  -- ── Setup (as postgres, before we drop into the simulated admin session) ──
  insert into auth.users (id, email) values (v_admin_user_id, 'test-admin@example.com');

  insert into tenants (name, slug, email, payroll_enabled)
  values ('Test Coop', 'test-coop-payroll', 'test-payroll@example.com', true)
  returning id into v_tenant_id;

  insert into tenant_users (tenant_id, user_id, role) values (v_tenant_id, v_admin_user_id, 'admin');

  insert into members (tenant_id, member_number, full_name, status, deduction_method, staff_id, recurring_contribution_amount_kobo)
  values (v_tenant_id, 'TESTCO000001', 'Test Member', 'ACTIVE', 'PAYROLL', 'STF-TEST-1', 500000) -- ₦5,000
  returning id into v_member_id;

  insert into loans (tenant_id, member_id, loan_number, principal_kobo, interest_rate_bps, tenure_months, status, disbursed_at)
  values (v_tenant_id, v_member_id, 'TEST-LOAN-0001', 1200000, 1800, 12, 'ACTIVE', now()) -- ₦12,000 principal, 18% p.a., 12 months
  returning id into v_loan_id;

  -- ── Simulate an authenticated admin session for the rest of this block ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  set local role authenticated;

  if get_tenant_id() <> v_tenant_id then
    raise exception 'session simulation failed: get_tenant_id() = %, expected %', get_tenant_id(), v_tenant_id;
  end if;
  raise notice 'simulated admin session OK (get_tenant_id() resolves correctly)';

  -- ── compute_loan_installment_due: sanity on known inputs ────────────────
  -- outstanding = 1,200,000 kobo; interest = round(1,200,000 * 1800 / 10000 / 12) = 18,000 kobo
  -- principal (straight-line, ~12 remaining months) ≈ 100,000 kobo
  -- total ≈ 118,000 kobo — assert it's in a sane range rather than pinning
  -- the exact number, since "months elapsed" is computed from now().
  v_installment := compute_loan_installment_due(v_loan_id);
  if v_installment < 100000 or v_installment > 130000 then
    raise exception 'compute_loan_installment_due out of expected range: got %', v_installment;
  end if;
  raise notice 'compute_loan_installment_due OK: % kobo', v_installment;

  -- ── generate_member_dues: creates one CONTRIBUTION + one LOAN_INSTALLMENT ──
  perform generate_member_dues(extract(month from now())::int, extract(year from now())::int);

  select count(*) into v_due_count from member_dues where tenant_id = v_tenant_id;
  if v_due_count <> 2 then
    raise exception 'expected 2 dues (1 contribution + 1 loan installment), got %', v_due_count;
  end if;
  raise notice 'generate_member_dues created % dues as expected', v_due_count;

  -- ── Idempotency: re-running the same period must not duplicate rows ─────
  perform generate_member_dues(extract(month from now())::int, extract(year from now())::int);

  select count(*) into v_due_count from member_dues where tenant_id = v_tenant_id;
  if v_due_count <> 2 then
    raise exception 'generate_member_dues is not idempotent: expected 2 dues after re-run, got %', v_due_count;
  end if;
  raise notice 'generate_member_dues idempotency OK: still % dues after re-run', v_due_count;

  -- ── generate_payroll_batch: packages the OPEN dues for our PAYROLL member ──
  select * into v_batch from generate_payroll_batch(extract(month from now())::int, extract(year from now())::int);
  if v_batch.member_count <> 1 then
    raise exception 'expected 1 member in the batch, got %', v_batch.member_count;
  end if;
  raise notice 'generate_payroll_batch OK: % member(s), % kobo total', v_batch.member_count, v_batch.total_amount_kobo;

  -- ── reconcile_payroll_item: posts the contribution + loan repayment ─────
  perform reconcile_payroll_item(
    (select id from payroll_batch_items where batch_id = v_batch.id),
    'DEDUCTED',
    v_batch.total_amount_kobo
  );

  if not exists (select 1 from contributions where member_id = v_member_id and channel = 'payroll' and status = 'COMPLETED') then
    raise exception 'reconcile_payroll_item did not post the contribution';
  end if;
  if not exists (select 1 from loan_repayments where loan_id = v_loan_id and channel = 'payroll') then
    raise exception 'reconcile_payroll_item did not post the loan repayment';
  end if;
  if exists (select 1 from member_dues where tenant_id = v_tenant_id and status = 'OPEN') then
    raise exception 'reconcile_payroll_item left an OPEN due behind — fulfillment hooks did not fire';
  end if;
  raise notice 'reconcile_payroll_item OK: contribution + loan repayment posted, dues fulfilled';

  raise notice 'ALL PAYROLL DEDUCTION CHECKS PASSED';
end $$;

rollback;
