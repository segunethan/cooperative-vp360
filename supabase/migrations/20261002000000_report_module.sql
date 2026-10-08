-- ============================================================
-- REPORT MODULE — background-job architecture
--
-- The admin Reports page was a static mockup with no real data and no
-- wiring. This wires it for real, but deliberately NOT as a synchronous
-- RPC call that runs the aggregation inline on the request — at a few
-- thousand members, a "whole year" financial statement query could be
-- heavy enough to risk an API-gateway timeout and ties up a live
-- connection for the whole computation.
--
-- Instead: report_requests is a small job queue. Generating a report is
-- just an INSERT (instant). A pg_cron worker ticks once a minute, claims
-- one QUEUED job at a time (`for update skip locked`, so it's safe even
-- if the interval is shortened or multiple workers ever run), and runs
-- the matching aggregation function. The admin UI polls the request row
-- until it settles. Every report builder is aggregate-only (SUM/COUNT/
-- GROUP BY over indexed tenant_id/status/period columns) — never a raw
-- per-row export — so cost stays flat regardless of tenant size.
-- ============================================================

create extension if not exists pg_cron;

create type report_type as enum (
  'CONTRIBUTION_SUMMARY',
  'LOAN_PORTFOLIO',
  'MEMBER_REGISTRY',
  'DIVIDEND_DISTRIBUTION',
  'FINANCIAL_STATEMENT'
);

create type report_status as enum ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

create table report_requests (
  id              uuid primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  report_type     report_type not null,
  params          jsonb not null default '{}',
  status          report_status not null default 'QUEUED',
  result          jsonb,
  error_message   text,
  requested_by    uuid references auth.users(id),
  requested_at    timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

create index idx_report_requests_tenant_status on report_requests(tenant_id, status);
create index idx_report_requests_tenant_type on report_requests(tenant_id, report_type, requested_at desc);
create index idx_report_requests_queue on report_requests(requested_at) where status = 'QUEUED';

alter table report_requests enable row level security;

create policy "report_requests_isolated" on report_requests
  for all using (tenant_id = get_tenant_id());

-- ============================================================
-- Report builders — one per type, aggregate-only, take tenant_id
-- explicitly (never get_tenant_id()) since the cron worker runs with no
-- authenticated session/JWT.
-- ============================================================

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
    'byChannel', v_by_channel
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
  v_outstanding_kobo bigint;
  v_active_count int;
  v_overdue_count int;
  v_overdue_kobo bigint;
begin
  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt, 'principalKobo', total) order by total desc), '[]'::jsonb)
  into v_by_status
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
    'overdueAmountKobo', v_overdue_kobo
  );
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
    'byStatus', v_by_status
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
begin
  if v_dividend_id is not null then
    select jsonb_build_object(
      'period', d.period, 'ratePct', d.rate_bps / 100.0, 'status', d.status,
      'totalAmountKobo', d.total_amount_kobo, 'eligibleMembers', d.eligible_members,
      'paidCount', (select count(*) from dividend_entitlements where dividend_id = d.id and paid_at is not null),
      'pendingCount', (select count(*) from dividend_entitlements where dividend_id = d.id and paid_at is null),
      'paidAmountKobo', (select coalesce(sum(entitlement_kobo), 0) from dividend_entitlements where dividend_id = d.id and paid_at is not null)
    )
    into v_dividends
    from dividends d
    where d.id = v_dividend_id and d.tenant_id = p_tenant_id;

    return coalesce(v_dividends, jsonb_build_object('error', 'dividend not found'));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'period', d.period, 'ratePct', d.rate_bps / 100.0, 'status', d.status,
    'totalAmountKobo', d.total_amount_kobo, 'eligibleMembers', d.eligible_members,
    'paidCount', (select count(*) from dividend_entitlements where dividend_id = d.id and paid_at is not null)
  ) order by d.created_at desc), '[]'::jsonb)
  into v_dividends
  from dividends d
  where d.tenant_id = p_tenant_id;

  return jsonb_build_object('dividends', v_dividends);
end;
$$;

create or replace function build_financial_statement_report(p_tenant_id uuid, p_params jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_year int := coalesce((p_params->>'period_year')::int, extract(year from now())::int);
  v_contributions_kobo bigint;
  v_loans_disbursed_kobo bigint;
  v_repayments_kobo bigint;
  v_dividends_paid_kobo bigint;
  v_outstanding_kobo bigint;
begin
  select coalesce(sum(amount_kobo), 0) into v_contributions_kobo
  from contributions where tenant_id = p_tenant_id and status = 'COMPLETED' and period_year = v_year;

  select coalesce(sum(principal_kobo), 0) into v_loans_disbursed_kobo
  from loans where tenant_id = p_tenant_id and extract(year from disbursed_at) = v_year;

  select coalesce(sum(amount_kobo), 0) into v_repayments_kobo
  from loan_repayments where tenant_id = p_tenant_id and extract(year from paid_at) = v_year;

  select coalesce(sum(de.entitlement_kobo), 0) into v_dividends_paid_kobo
  from dividend_entitlements de
  where de.tenant_id = p_tenant_id and de.paid_at is not null and extract(year from de.paid_at) = v_year;

  select coalesce(sum(l.principal_kobo), 0) - coalesce((select sum(lr.principal_portion_kobo) from loan_repayments lr join loans l2 on l2.id = lr.loan_id where l2.tenant_id = p_tenant_id and l2.status = 'ACTIVE'), 0)
  into v_outstanding_kobo
  from loans l where l.tenant_id = p_tenant_id and l.status = 'ACTIVE';

  return jsonb_build_object(
    'periodYear', v_year,
    'totalContributionsKobo', v_contributions_kobo,
    'totalLoansDisbursedKobo', v_loans_disbursed_kobo,
    'totalRepaymentsReceivedKobo', v_repayments_kobo,
    'totalDividendsPaidKobo', v_dividends_paid_kobo,
    'outstandingLoanPrincipalKobo', greatest(v_outstanding_kobo, 0)
  );
end;
$$;

-- ============================================================
-- Dispatcher + worker
-- ============================================================

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
    set status = 'COMPLETED', result = v_result, completed_at = now()
    where id = p_request_id;
  exception when others then
    update report_requests
    set status = 'FAILED', error_message = sqlerrm, completed_at = now()
    where id = p_request_id;
  end;
end;
$$;

-- Claims exactly one QUEUED job per tick. `for update skip locked` makes
-- this safe even with overlapping worker runs — nothing here depends on
-- the cron interval staying at any particular value.
create or replace function process_next_report()
returns void
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  update report_requests
  set status = 'PROCESSING', started_at = now()
  where id = (
    select id from report_requests
    where status = 'QUEUED'
    order by requested_at
    limit 1
    for update skip locked
  )
  returning id into v_id;

  if v_id is not null then
    perform run_report(v_id);
  end if;
end;
$$;

-- Client-callable: queues a report and returns immediately. The actual
-- work happens on the next cron tick, not in this call.
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

  insert into report_requests (tenant_id, report_type, params, requested_by)
  values (v_tenant_id, p_report_type, p_params, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

select cron.schedule('process-report-requests', '*/1 * * * *', $$select process_next_report();$$);
