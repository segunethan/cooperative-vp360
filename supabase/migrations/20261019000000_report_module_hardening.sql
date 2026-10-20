-- ============================================================
-- REPORT MODULE HARDENING
--
-- Follow-up to 20261002000000_report_module.sql after a production-
-- readiness audit. Three real gaps found:
--
-- 1. request_report() accepted any jsonb params with zero validation —
--    a malformed period_month/period_year would fail silently inside the
--    cron worker (marked FAILED with an opaque sqlerrm) instead of being
--    rejected immediately with an actionable error at request time.
-- 2. report_requests had no row-count metric, only timestamps — so there
--    was no way to see how many underlying records a report actually
--    covered without opening its JSON result.
-- 3. "Member Registry Report" only ever returned aggregate counts
--    (byStatus/kycVerifiedCount/newThisMonth) — it never gave the actual
--    member list the name promises. That's addressed on the client side
--    (direct keyset-paginated reads against `members`, already tenant-
--    isolated by the existing members_isolated RLS policy — no new RPC
--    needed for that path), but the summary builder here gains a
--    rowCount field for consistency with the other report types.
-- ============================================================

create or replace function validate_report_params(p_report_type report_type, p_params jsonb)
returns void
language plpgsql
as $$
declare
  v_month int;
  v_year int;
begin
  if p_report_type in ('CONTRIBUTION_SUMMARY', 'FINANCIAL_STATEMENT') then
    if p_params ? 'period_year' then
      v_year := (p_params->>'period_year')::int;
      if v_year < 2000 or v_year > 2100 then
        raise exception 'period_year out of range: %', v_year;
      end if;
    end if;
  end if;

  if p_report_type = 'CONTRIBUTION_SUMMARY' and p_params ? 'period_month' then
    v_month := (p_params->>'period_month')::int;
    if v_month < 1 or v_month > 12 then
      raise exception 'period_month out of range: %', v_month;
    end if;
  end if;

  if p_report_type = 'DIVIDEND_DISTRIBUTION' and p_params ? 'dividend_id' then
    -- raises its own clear error if the value isn't a valid uuid
    perform (p_params->>'dividend_id')::uuid;
  end if;
exception
  when invalid_text_representation then
    raise exception 'invalid parameter value for % report: %', p_report_type, p_params;
end;
$$;

alter table report_requests add column row_count int;

create or replace function request_report(p_report_type report_type, p_params jsonb default '{}')
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  perform validate_report_params(p_report_type, p_params);

  insert into report_requests (tenant_id, report_type, params, requested_by)
  values (v_tenant_id, p_report_type, p_params, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function build_member_registry_report(p_tenant_id uuid, p_params jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_by_status jsonb;
  v_total int;
  v_kyc_verified int;
  v_new_this_month int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by cnt desc), '[]'::jsonb)
  into v_by_status
  from (
    select status, count(*) as cnt
    from members
    where tenant_id = p_tenant_id
    group by status
  ) t;

  select count(*), count(*) filter (where kyc_verified)
  into v_total, v_kyc_verified
  from members
  where tenant_id = p_tenant_id;

  select count(*)
  into v_new_this_month
  from members
  where tenant_id = p_tenant_id
    and date_trunc('month', joined_at) = date_trunc('month', now());

  return jsonb_build_object(
    'totalMembers', v_total,
    'kycVerifiedCount', v_kyc_verified,
    'newThisMonth', v_new_this_month,
    'byStatus', v_by_status,
    'rowCount', v_total
  );
end;
$$;

create or replace function build_contribution_summary_report(p_tenant_id uuid, p_params jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_month int := coalesce((p_params->>'period_month')::int, extract(month from now())::int);
  v_year int := coalesce((p_params->>'period_year')::int, extract(year from now())::int);
  v_total_kobo bigint;
  v_count int;
  v_by_channel jsonb;
begin
  select coalesce(sum(amount_kobo), 0), count(*)
  into v_total_kobo, v_count
  from contributions
  where tenant_id = p_tenant_id and status = 'COMPLETED'
    and period_month = v_month and period_year = v_year;

  select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'totalKobo', total, 'count', cnt) order by total desc), '[]'::jsonb)
  into v_by_channel
  from (
    select channel, sum(amount_kobo) as total, count(*) as cnt
    from contributions
    where tenant_id = p_tenant_id and status = 'COMPLETED'
      and period_month = v_month and period_year = v_year
    group by channel
  ) t;

  return jsonb_build_object(
    'periodMonth', v_month, 'periodYear', v_year,
    'totalKobo', v_total_kobo, 'contributionCount', v_count,
    'byChannel', v_by_channel, 'rowCount', v_count
  );
end;
$$;

create or replace function build_loan_portfolio_report(p_tenant_id uuid, p_params jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_by_status jsonb;
  v_total_loans int;
  v_outstanding_kobo bigint;
  v_active_count int;
  v_overdue_count int;
  v_overdue_kobo bigint;
begin
  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt, 'principalKobo', total) order by total desc), '[]'::jsonb),
         coalesce(sum(cnt), 0)
  into v_by_status, v_total_loans
  from (
    select status, count(*) as cnt, sum(principal_kobo) as total
    from loans
    where tenant_id = p_tenant_id
    group by status
  ) t;

  select
    count(*) filter (where l.status = 'ACTIVE'),
    coalesce(sum(l.principal_kobo) filter (where l.status = 'ACTIVE'), 0)
      - coalesce((select sum(lr.principal_portion_kobo) from loan_repayments lr join loans l2 on l2.id = lr.loan_id where l2.tenant_id = p_tenant_id and l2.status = 'ACTIVE'), 0)
  into v_active_count, v_outstanding_kobo
  from loans l
  where l.tenant_id = p_tenant_id;

  select count(distinct loan_id), coalesce(sum(installment_amount_kobo - paid_amount_kobo), 0)
  into v_overdue_count, v_overdue_kobo
  from loan_installments
  where tenant_id = p_tenant_id and status <> 'PAID' and due_date < current_date;

  return jsonb_build_object(
    'byStatus', v_by_status,
    'activeLoanCount', v_active_count,
    'outstandingPrincipalKobo', greatest(v_outstanding_kobo, 0),
    'overdueLoanCount', v_overdue_count,
    'overdueAmountKobo', v_overdue_kobo,
    'rowCount', v_total_loans
  );
end;
$$;

create or replace function build_dividend_distribution_report(p_tenant_id uuid, p_params jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_dividend_id uuid := (p_params->>'dividend_id')::uuid;
  v_dividends jsonb;
  v_count int;
begin
  if v_dividend_id is not null then
    select jsonb_build_object(
      'period', d.period, 'ratePct', d.rate_bps / 100.0, 'status', d.status,
      'totalAmountKobo', d.total_amount_kobo, 'eligibleMembers', d.eligible_members,
      'paidCount', (select count(*) from dividend_entitlements where dividend_id = d.id and paid_at is not null),
      'pendingCount', (select count(*) from dividend_entitlements where dividend_id = d.id and paid_at is null),
      'paidAmountKobo', (select coalesce(sum(entitlement_kobo), 0) from dividend_entitlements where dividend_id = d.id and paid_at is not null),
      'rowCount', d.eligible_members
    )
    into v_dividends
    from dividends d
    where d.id = v_dividend_id and d.tenant_id = p_tenant_id;

    return coalesce(v_dividends, jsonb_build_object('error', 'dividend not found'));
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'period', d.period, 'ratePct', d.rate_bps / 100.0, 'status', d.status,
      'totalAmountKobo', d.total_amount_kobo, 'eligibleMembers', d.eligible_members,
      'paidCount', (select count(*) from dividend_entitlements where dividend_id = d.id and paid_at is not null)
    ) order by d.created_at desc), '[]'::jsonb),
    count(*)
  into v_dividends, v_count
  from dividends d
  where d.tenant_id = p_tenant_id;

  return jsonb_build_object('dividends', v_dividends, 'rowCount', v_count);
end;
$$;

-- Duration is already derivable from started_at/completed_at. row_count
-- is read off the builder's own `rowCount` key so it stays in lock-step
-- with whatever the report actually counted, rather than being computed
-- a second, possibly-inconsistent way.
create or replace function run_report(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_req record;
  v_result jsonb;
begin
  select * into v_req from report_requests where id = p_request_id for update;
  if not found then
    return;
  end if;

  begin
    case v_req.report_type
      when 'CONTRIBUTION_SUMMARY' then v_result := build_contribution_summary_report(v_req.tenant_id, v_req.params);
      when 'LOAN_PORTFOLIO' then v_result := build_loan_portfolio_report(v_req.tenant_id, v_req.params);
      when 'MEMBER_REGISTRY' then v_result := build_member_registry_report(v_req.tenant_id, v_req.params);
      when 'DIVIDEND_DISTRIBUTION' then v_result := build_dividend_distribution_report(v_req.tenant_id, v_req.params);
      when 'FINANCIAL_STATEMENT' then v_result := build_financial_statement_report(v_req.tenant_id, v_req.params);
    end case;

    update report_requests
    set status = 'COMPLETED', result = v_result, completed_at = now(),
        row_count = (v_result->>'rowCount')::int
    where id = p_request_id;
  exception when others then
    update report_requests
    set status = 'FAILED', error_message = sqlerrm, completed_at = now()
    where id = p_request_id;
  end;
end;
$$;
