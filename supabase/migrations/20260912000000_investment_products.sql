-- ============================================================
-- INVESTMENT PRODUCTS, TOP-UPS/WITHDRAWALS, LOAN TOP-UPS
-- ============================================================

create type product_type as enum ('OPEN_ENDED', 'FIXED_TENOR', 'GOAL_BASED');
create type product_status as enum ('ACTIVE', 'DRAFT');
create type subscription_status as enum ('PENDING', 'ACTIVE', 'REJECTED', 'EXITED');
create type request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type subscription_request_type as enum ('TOPUP', 'WITHDRAWAL');
create type ledger_entry_type as enum ('INITIAL', 'RATE_APPLIED', 'TOPUP', 'WITHDRAWAL');

-- ============================================================
-- PRODUCTS (tenant-scoped catalog, admin-editable)
-- ============================================================
create table products (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  slug                text not null,
  tagline             text,
  description         text,
  icon                text not null default 'piggy-bank',   -- piggy-bank | trending-up | wallet | banknote | coins
  product_type        product_type not null,
  min_investment_kobo bigint not null default 0 check (min_investment_kobo >= 0),
  tenor_options       jsonb,                                 -- e.g. [3,6,9,12,18,24] months, null for OPEN_ENDED
  status              product_status not null default 'DRAFT',
  terms               jsonb not null default '{}'::jsonb,    -- admin-authored description/FAQ content
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(tenant_id, slug)
);

-- ============================================================
-- PRODUCT SUBSCRIPTIONS (a member's position in a product)
-- ============================================================
create table product_subscriptions (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  member_id           uuid not null references members(id) on delete restrict,
  product_id          uuid not null references products(id) on delete restrict,
  principal_kobo      bigint not null check (principal_kobo > 0),
  current_balance_kobo bigint not null check (current_balance_kobo >= 0),
  tenor_months        int,
  variant             text,                                  -- GUIDED | UNGUIDED (GOAL_BASED only)
  target_amount_kobo  bigint,
  status              subscription_status not null default 'PENDING',
  invested_at         timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_product_subscriptions_member on product_subscriptions(tenant_id, member_id);
create index idx_product_subscriptions_product on product_subscriptions(tenant_id, product_id);

-- ============================================================
-- PRODUCT SUBSCRIPTION REQUESTS (top-ups / withdrawals on an existing subscription)
-- ============================================================
create table product_subscription_requests (
  id              uuid primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  subscription_id uuid not null references product_subscriptions(id) on delete cascade,
  member_id       uuid not null references members(id) on delete restrict,
  request_type    subscription_request_type not null,
  amount_kobo     bigint not null check (amount_kobo > 0),
  status          request_status not null default 'PENDING',
  requested_at    timestamptz not null default now(),
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  notes           text
);

create index idx_product_subscription_requests_subscription on product_subscription_requests(tenant_id, subscription_id);

-- ============================================================
-- PRODUCT RATE UPDATES (one row per admin publish event)
-- ============================================================
create table product_rate_updates (
  id            uuid primary key default extensions.uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  rate_percent  numeric not null,
  note          text,
  published_by  uuid references auth.users(id),
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index idx_product_rate_updates_product on product_rate_updates(tenant_id, product_id, published_at desc);

-- ============================================================
-- PRODUCT SUBSCRIPTION LEDGER (append-only transaction history)
-- ============================================================
create table product_subscription_ledger (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  subscription_id     uuid not null references product_subscriptions(id) on delete cascade,
  entry_type          ledger_entry_type not null,
  rate_update_id      uuid references product_rate_updates(id),
  request_id          uuid references product_subscription_requests(id),
  balance_before_kobo bigint not null check (balance_before_kobo >= 0),
  amount_kobo         bigint not null,
  balance_after_kobo  bigint not null check (balance_after_kobo >= 0),
  effective_at        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index idx_product_subscription_ledger_subscription on product_subscription_ledger(tenant_id, subscription_id, effective_at);

create trigger product_subscription_ledger_immutable_update
  before update on product_subscription_ledger
  for each row execute function prevent_journal_mutation();

create trigger product_subscription_ledger_immutable_delete
  before delete on product_subscription_ledger
  for each row execute function prevent_journal_mutation();

-- ============================================================
-- LOAN TOP-UP REQUESTS
-- ============================================================
create table loan_topup_requests (
  id            uuid primary key default extensions.uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  loan_id       uuid not null references loans(id) on delete cascade,
  member_id     uuid not null references members(id) on delete restrict,
  amount_kobo   bigint not null check (amount_kobo > 0),
  status        request_status not null default 'PENDING',
  requested_at  timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  notes         text
);

create index idx_loan_topup_requests_loan on loan_topup_requests(tenant_id, loan_id);

-- ============================================================
-- RPCS
-- ============================================================

-- Publish a rate for a product: fans out one ledger row + balance update per active subscription.
create or replace function publish_product_rate(p_product_id uuid, p_rate_percent numeric, p_note text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_rate_update_id uuid;
  v_sub record;
  v_interest bigint;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  insert into product_rate_updates (tenant_id, product_id, rate_percent, note, published_by)
  values (v_tenant_id, p_product_id, p_rate_percent, p_note, auth.uid())
  returning id into v_rate_update_id;

  for v_sub in
    select id, current_balance_kobo
    from product_subscriptions
    where tenant_id = v_tenant_id and product_id = p_product_id and status = 'ACTIVE'
    for update
  loop
    v_interest := round(v_sub.current_balance_kobo * p_rate_percent / 100.0);

    insert into product_subscription_ledger (
      tenant_id, subscription_id, entry_type, rate_update_id,
      balance_before_kobo, amount_kobo, balance_after_kobo, effective_at
    ) values (
      v_tenant_id, v_sub.id, 'RATE_APPLIED', v_rate_update_id,
      v_sub.current_balance_kobo, v_interest, v_sub.current_balance_kobo + v_interest, now()
    );

    update product_subscriptions
    set current_balance_kobo = v_sub.current_balance_kobo + v_interest,
        updated_at = now()
    where id = v_sub.id;
  end loop;

  return v_rate_update_id;
end;
$$;

-- Approve or reject a top-up/withdrawal request on an existing subscription.
create or replace function review_subscription_request(p_request_id uuid, p_approve boolean, p_reviewer uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_req record;
  v_sub record;
  v_new_balance bigint;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_req from product_subscription_requests
  where id = p_request_id and tenant_id = v_tenant_id and status = 'PENDING'
  for update;

  if not found then
    raise exception 'request not found or already reviewed';
  end if;

  if not p_approve then
    update product_subscription_requests
    set status = 'REJECTED', reviewed_by = p_reviewer, reviewed_at = now()
    where id = p_request_id;
    return;
  end if;

  select * into v_sub from product_subscriptions
  where id = v_req.subscription_id and tenant_id = v_tenant_id
  for update;

  if v_req.request_type = 'TOPUP' then
    v_new_balance := v_sub.current_balance_kobo + v_req.amount_kobo;

    insert into product_subscription_ledger (
      tenant_id, subscription_id, entry_type, request_id,
      balance_before_kobo, amount_kobo, balance_after_kobo, effective_at
    ) values (
      v_tenant_id, v_sub.id, 'TOPUP', p_request_id,
      v_sub.current_balance_kobo, v_req.amount_kobo, v_new_balance, now()
    );

    update product_subscriptions
    set principal_kobo = principal_kobo + v_req.amount_kobo,
        current_balance_kobo = v_new_balance,
        updated_at = now()
    where id = v_sub.id;
  else
    if v_req.amount_kobo > v_sub.current_balance_kobo then
      raise exception 'withdrawal amount exceeds current balance';
    end if;

    v_new_balance := v_sub.current_balance_kobo - v_req.amount_kobo;

    insert into product_subscription_ledger (
      tenant_id, subscription_id, entry_type, request_id,
      balance_before_kobo, amount_kobo, balance_after_kobo, effective_at
    ) values (
      v_tenant_id, v_sub.id, 'WITHDRAWAL', p_request_id,
      v_sub.current_balance_kobo, -v_req.amount_kobo, v_new_balance, now()
    );

    update product_subscriptions
    set current_balance_kobo = v_new_balance,
        status = case when v_new_balance = 0 then 'EXITED' else status end,
        updated_at = now()
    where id = v_sub.id;
  end if;

  update product_subscription_requests
  set status = 'APPROVED', reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_request_id;
end;
$$;

-- Approve/reject a loan top-up request.
create or replace function review_loan_topup(p_request_id uuid, p_approve boolean, p_reviewer uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  update loan_topup_requests
  set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
      reviewed_by = p_reviewer,
      reviewed_at = now()
  where id = p_request_id and tenant_id = v_tenant_id and status = 'PENDING';

  if not found then
    raise exception 'request not found or already reviewed';
  end if;
end;
$$;

-- Record a loan repayment: flat monthly interest on outstanding balance, remainder reduces principal.
create or replace function record_loan_repayment(
  p_loan_id uuid, p_amount_kobo bigint, p_channel text, p_paid_at timestamptz, p_reference text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_loan record;
  v_outstanding bigint;
  v_interest_due bigint;
  v_interest_portion bigint;
  v_principal_portion bigint;
  v_repayment_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select * into v_loan from loans where id = p_loan_id and tenant_id = v_tenant_id for update;
  if not found then
    raise exception 'loan not found';
  end if;

  v_outstanding := v_loan.principal_kobo
    + coalesce((select sum(amount_kobo) from loan_topup_requests where loan_id = p_loan_id and status = 'APPROVED'), 0)
    - coalesce((select sum(principal_portion_kobo) from loan_repayments where loan_id = p_loan_id), 0);

  v_interest_due := round(v_outstanding * v_loan.interest_rate_bps / 10000.0 / 12);
  v_interest_portion := least(p_amount_kobo, v_interest_due);
  v_principal_portion := p_amount_kobo - v_interest_portion;

  insert into loan_repayments (
    tenant_id, loan_id, amount_kobo, principal_portion_kobo, interest_portion_kobo, channel, reference, paid_at
  ) values (
    v_tenant_id, p_loan_id, p_amount_kobo, v_principal_portion, v_interest_portion, p_channel, p_reference, p_paid_at
  ) returning id into v_repayment_id;

  if v_principal_portion >= v_outstanding then
    update loans set status = 'REPAID', updated_at = now() where id = p_loan_id;
  end if;

  return v_repayment_id;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table products enable row level security;
alter table product_subscriptions enable row level security;
alter table product_subscription_requests enable row level security;
alter table product_rate_updates enable row level security;
alter table product_subscription_ledger enable row level security;
alter table loan_topup_requests enable row level security;

create policy "products_isolated" on products
  for all using (tenant_id = get_tenant_id());

create policy "products_member_select" on products
  for select using (tenant_id in (select tenant_id from members where auth_user_id = auth.uid()));

create policy "product_subscriptions_isolated" on product_subscriptions
  for all using (tenant_id = get_tenant_id());

create policy "product_subscriptions_self_select" on product_subscriptions
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "product_subscriptions_self_insert" on product_subscriptions
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
  );

create policy "product_subscription_requests_isolated" on product_subscription_requests
  for all using (tenant_id = get_tenant_id());

create policy "product_subscription_requests_self_select" on product_subscription_requests
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "product_subscription_requests_self_insert" on product_subscription_requests
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
    and subscription_id in (
      select id from product_subscriptions
      where member_id in (select id from members where auth_user_id = auth.uid())
        and status = 'ACTIVE'
    )
  );

create policy "product_rate_updates_isolated" on product_rate_updates
  for all using (tenant_id = get_tenant_id());

create policy "product_rate_updates_member_select" on product_rate_updates
  for select using (tenant_id in (select tenant_id from members where auth_user_id = auth.uid()));

create policy "product_subscription_ledger_isolated" on product_subscription_ledger
  for all using (tenant_id = get_tenant_id());

create policy "product_subscription_ledger_self_select" on product_subscription_ledger
  for select using (
    subscription_id in (
      select id from product_subscriptions
      where member_id in (select id from members where auth_user_id = auth.uid())
    )
  );

create policy "loan_topup_requests_isolated" on loan_topup_requests
  for all using (tenant_id = get_tenant_id());

create policy "loan_topup_requests_self_select" on loan_topup_requests
  for select using (member_id in (select id from members where auth_user_id = auth.uid()));

create policy "loan_topup_requests_self_insert" on loan_topup_requests
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
    and loan_id in (
      select id from loans
      where member_id in (select id from members where auth_user_id = auth.uid())
        and status = 'ACTIVE'
    )
  );

-- Members need to read their own loan's repayment history for the ledger view —
-- loan_repayments only had an admin-isolated policy before this.
create policy "loan_repayments_self_select" on loan_repayments
  for select using (
    loan_id in (
      select id from loans
      where member_id in (select id from members where auth_user_id = auth.uid())
    )
  );

-- Drive-by fix: contributions/loans had no member self-insert policy at all —
-- the only existing policy (tenant_id = get_tenant_id()) resolves to NULL for a
-- member (no tenant_users row), so member-submitted inserts silently failed RLS.
create policy "contributions_self_insert" on contributions
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
  );

create policy "loans_self_insert" on loans
  for insert with check (
    status = 'PENDING'
    and member_id in (select id from members where auth_user_id = auth.uid())
  );
