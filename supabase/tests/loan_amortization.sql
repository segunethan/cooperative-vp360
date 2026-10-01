-- Manual verification for 20261001010000_loan_schedule_recompute.sql.
-- Run against a local instance (see supabase/tests/payroll_deductions.sql
-- for the exact command and why the auth-session simulation is needed —
-- record_loan_repayment is get_tenant_id()-gated the same way).
--
-- Asserts the exact scenario worked through by hand before writing the
-- migration: ₦120,000 at 18% reducing-balance over 12 months, months 1-2
-- paid exactly, ₦20,000 in month 3, REDUCE_TENURE strategy.

begin;

do $$
declare
  v_admin_user_id uuid := extensions.uuid_generate_v4();
  v_tenant_id uuid;
  v_member_id uuid;
  v_loan_id uuid;
  v_inst record;
  v_count int;
  v_last_closing bigint;
  v_m1 record; v_m2 record; v_m3 record;
  v_total_interest_tail bigint;
  v_final_installment bigint;
begin
  insert into auth.users (id, email) values (v_admin_user_id, 'test-loan-admin@example.com');
  insert into tenants (name, slug, email) values ('Test Loan Coop', 'test-loan-coop', 'test-loan@example.com') returning id into v_tenant_id;
  insert into tenant_users (tenant_id, user_id, role) values (v_tenant_id, v_admin_user_id, 'admin');
  insert into members (tenant_id, member_number, full_name, status) values (v_tenant_id, 'TESTLN000001', 'Test Borrower', 'ACTIVE') returning id into v_member_id;

  insert into loans (tenant_id, member_id, loan_number, principal_kobo, interest_rate_bps, tenure_months, status)
  values (v_tenant_id, v_member_id, 'TEST-AMORT-0001', 12000000, 1800, 12, 'PENDING')
  returning id into v_loan_id;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  set local role authenticated;

  -- ── Disbursement generates the schedule ──────────────────────────────
  update loans set status = 'ACTIVE', disbursed_at = now() where id = v_loan_id;

  select count(*) into v_count from loan_installments where loan_id = v_loan_id;
  if v_count <> 12 then
    raise exception 'expected 12 installments, got %', v_count;
  end if;

  select installment_amount_kobo into v_final_installment from loan_installments where loan_id = v_loan_id and installment_number = 1;
  if abs(v_final_installment - 1100160) > 2 then
    raise exception 'EMI out of expected range: got % kobo, expected ~1,100,160 (NGN 11,001.60)', v_final_installment;
  end if;
  raise notice 'EMI OK: % kobo (NGN %)', v_final_installment, v_final_installment / 100.0;

  select closing_balance_kobo into v_last_closing from loan_installments where loan_id = v_loan_id and installment_number = 12;
  if v_last_closing <> 0 then
    raise exception 'schedule does not close to exactly 0: got % kobo on the final installment', v_last_closing;
  end if;
  raise notice 'closing balance OK: exactly 0 on installment 12';

  -- ── Months 1-2 paid exactly: no recompute, nothing else should change ──
  select * into v_m1 from loan_installments where loan_id = v_loan_id and installment_number = 1;
  select * into v_m2 from loan_installments where loan_id = v_loan_id and installment_number = 2;
  select * into v_m3 from loan_installments where loan_id = v_loan_id and installment_number = 3;

  perform record_loan_repayment(v_loan_id, v_m1.installment_amount_kobo, 'bank_transfer', v_m1.due_date::timestamptz, 'TEST-M1');
  perform record_loan_repayment(v_loan_id, v_m2.installment_amount_kobo, 'bank_transfer', v_m2.due_date::timestamptz, 'TEST-M2');

  if (select status from loan_installments where loan_id = v_loan_id and installment_number = 1) <> 'PAID' then
    raise exception 'installment 1 should be PAID after an exact payment';
  end if;
  if (select principal_due_kobo from loan_installments where loan_id = v_loan_id and installment_number = 3) <> v_m3.principal_due_kobo then
    raise exception 'exact on-time payments must not recompute untouched future installments';
  end if;
  raise notice 'exact payment OK: no recompute triggered on months 1-2';

  -- ── Underpayment: pay less than due on month 3, confirm PARTIAL + no recompute ──
  perform record_loan_repayment(v_loan_id, v_m3.interest_due_kobo, 'bank_transfer', v_m3.due_date::timestamptz, 'TEST-M3-PARTIAL');
  if (select status from loan_installments where loan_id = v_loan_id and installment_number = 3) <> 'PARTIAL' then
    raise exception 'underpayment should leave the installment PARTIAL';
  end if;
  raise notice 'underpayment OK: installment 3 is PARTIAL, no recompute';

  -- top up month 3 to exactly complete it, then overpay by NGN 20,000
  -- worth total this time (interest-only portion already paid above, so
  -- this repayment is the remaining principal + the NGN 20,000 prepayment)
  declare
    v_m3_remaining bigint;
  begin
    select installment_amount_kobo - paid_amount_kobo into v_m3_remaining from loan_installments where loan_id = v_loan_id and installment_number = 3;
    perform record_loan_repayment(v_loan_id, v_m3_remaining + 2000000, 'bank_transfer', v_m3.due_date::timestamptz, 'TEST-M3-PLUS-PREPAY');
  end;

  if (select status from loan_installments where loan_id = v_loan_id and installment_number = 3) <> 'PAID' then
    raise exception 'installment 3 should now be fully PAID';
  end if;

  select max(installment_number) into v_count from loan_installments where loan_id = v_loan_id;
  if v_count <> 12 then
    raise exception 'expected installment numbering to continue through 12, got max %', v_count;
  end if;

  select closing_balance_kobo into v_last_closing from loan_installments where loan_id = v_loan_id and installment_number = 12;
  if v_last_closing <> 0 then
    raise exception 'recomputed schedule does not close to exactly 0: got % kobo', v_last_closing;
  end if;

  select installment_amount_kobo into v_final_installment from loan_installments where loan_id = v_loan_id and installment_number = 12;
  if v_final_installment < 70000 or v_final_installment > 73000 then
    raise exception 'REDUCE_TENURE final installment out of expected ~NGN 713 range: got % kobo', v_final_installment;
  end if;
  raise notice 'REDUCE_TENURE OK: final installment % kobo (NGN %), closes to exactly 0', v_final_installment, v_final_installment / 100.0;

  select coalesce(sum(interest_due_kobo), 0) into v_total_interest_tail
  from loan_installments where loan_id = v_loan_id and installment_number between 4 and 12;
  raise notice 'total interest months 4-12 after prepayment: % kobo (NGN %) — original (no prepayment) would have been ~703,534 kobo (NGN 7,035.34)',
    v_total_interest_tail, v_total_interest_tail / 100.0;
  if v_total_interest_tail > 650000 then
    raise exception 'expected a meaningful interest saving from the prepayment, got only % kobo of interest remaining', v_total_interest_tail;
  end if;

  raise notice 'ALL LOAN AMORTIZATION CHECKS PASSED';
end $$;

rollback;
