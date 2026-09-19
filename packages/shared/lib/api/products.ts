import { supabase } from "../supabase";
import { handleSupabaseError, NotFoundError } from "../errors";

export type ProductType = "OPEN_ENDED" | "FIXED_TENOR" | "GOAL_BASED";
export type ProductStatus = "ACTIVE" | "DRAFT";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "REJECTED" | "EXITED";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SubscriptionRequestType = "TOPUP" | "WITHDRAWAL";
export type FundingSource = "EXTERNAL_PAYMENT" | "CONTRIBUTION_TRANSFER";
export type LedgerEntryType = "INITIAL" | "RATE_APPLIED" | "TOPUP" | "WITHDRAWAL";

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  icon: string;
  productType: ProductType;
  minInvestmentKobo: number;
  tenorOptions: number[] | null;
  status: ProductStatus;
  terms: Record<string, unknown>;
  creditAccountInfo: string | null;
}

export interface ProductSubscription {
  id: string;
  memberId: string;
  productId: string;
  principalKobo: number;
  currentBalanceKobo: number;
  tenorMonths: number | null;
  variant: string | null;
  targetAmountKobo: number | null;
  status: SubscriptionStatus;
  investedAt: string | null;
  createdAt: string;
  product?: Product;
}

export interface LedgerRow {
  id: string;
  entryType: LedgerEntryType;
  balanceBeforeKobo: number;
  amountKobo: number;
  balanceAfterKobo: number;
  effectiveAt: string;
}

const toProduct = (row: Record<string, unknown>): Product => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  name: row.name as string,
  slug: row.slug as string,
  tagline: (row.tagline as string) ?? null,
  description: (row.description as string) ?? null,
  icon: row.icon as string,
  productType: row.product_type as ProductType,
  minInvestmentKobo: row.min_investment_kobo as number,
  tenorOptions: (row.tenor_options as number[]) ?? null,
  status: row.status as ProductStatus,
  terms: (row.terms as Record<string, unknown>) ?? {},
  creditAccountInfo: (row.credit_account_info as string) ?? null,
});

const toSubscription = (row: Record<string, unknown>): ProductSubscription => ({
  id: row.id as string,
  memberId: row.member_id as string,
  productId: row.product_id as string,
  principalKobo: row.principal_kobo as number,
  currentBalanceKobo: row.current_balance_kobo as number,
  tenorMonths: (row.tenor_months as number) ?? null,
  variant: (row.variant as string) ?? null,
  targetAmountKobo: (row.target_amount_kobo as number) ?? null,
  status: row.status as SubscriptionStatus,
  investedAt: (row.invested_at as string) ?? null,
  createdAt: row.created_at as string,
  product: row.products ? toProduct(row.products as Record<string, unknown>) : undefined,
});

const toLedgerRow = (row: Record<string, unknown>): LedgerRow => ({
  id: row.id as string,
  entryType: row.entry_type as LedgerEntryType,
  balanceBeforeKobo: row.balance_before_kobo as number,
  amountKobo: row.amount_kobo as number,
  balanceAfterKobo: row.balance_after_kobo as number,
  effectiveAt: row.effective_at as string,
});

// ── Member-facing reads ────────────────────────────────────────────────────

export const fetchActiveProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toProduct);
};

export const fetchProductBySlug = async (slug: string): Promise<Product> => {
  const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
  if (error) handleSupabaseError(error);
  if (!data) throw new NotFoundError("Product", slug);
  return toProduct(data);
};

export const fetchProductById = async (id: string): Promise<Product> => {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) handleSupabaseError(error);
  if (!data) throw new NotFoundError("Product", id);
  return toProduct(data);
};

export const fetchMemberSubscriptions = async (memberId: string): Promise<ProductSubscription[]> => {
  const { data, error } = await supabase
    .from("product_subscriptions")
    .select("*, products(*)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toSubscription);
};

export const fetchSubscriptionLedger = async (subscriptionId: string): Promise<LedgerRow[]> => {
  const { data, error } = await supabase
    .from("product_subscription_ledger")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("effective_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toLedgerRow);
};

export const fetchLatestRateUpdate = async (productId: string): Promise<{ ratePercent: number; publishedAt: string } | null> => {
  const { data, error } = await supabase
    .from("product_rate_updates")
    .select("rate_percent, published_at")
    .eq("product_id", productId)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? { ratePercent: data.rate_percent, publishedAt: data.published_at } : null;
};

// ── Member-facing writes ───────────────────────────────────────────────────

export const subscribeToProduct = async (params: {
  tenantId: string;
  memberId: string;
  productId: string;
  principalKobo: number;
  tenorMonths?: number;
  variant?: string;
  targetAmountKobo?: number;
  fundingSource: FundingSource;
  receiptUrl?: string;
}): Promise<void> => {
  const { error } = await supabase.from("product_subscriptions").insert({
    tenant_id: params.tenantId,
    member_id: params.memberId,
    product_id: params.productId,
    principal_kobo: params.principalKobo,
    current_balance_kobo: params.principalKobo,
    tenor_months: params.tenorMonths ?? null,
    variant: params.variant ?? null,
    target_amount_kobo: params.targetAmountKobo ?? null,
    status: "PENDING",
    funding_source: params.fundingSource,
    receipt_url: params.receiptUrl ?? null,
  });
  if (error) handleSupabaseError(error);
};

export const requestSubscriptionChange = async (params: {
  tenantId: string;
  subscriptionId: string;
  memberId: string;
  requestType: SubscriptionRequestType;
  amountKobo: number;
  notes?: string;
  fundingSource?: FundingSource;
  receiptUrl?: string;
}): Promise<void> => {
  const { error } = await supabase.from("product_subscription_requests").insert({
    tenant_id: params.tenantId,
    subscription_id: params.subscriptionId,
    member_id: params.memberId,
    request_type: params.requestType,
    amount_kobo: params.amountKobo,
    notes: params.notes ?? null,
    funding_source: params.requestType === "TOPUP" ? params.fundingSource : null,
    receipt_url: params.requestType === "TOPUP" ? params.receiptUrl ?? null : null,
  });
  if (error) handleSupabaseError(error);
};

// ── Available contribution balance (for "move from my contributions" funding) ──

export const fetchAvailableContributionBalance = async (memberId: string): Promise<number> => {
  const [{ data: contribs }, { data: subs }, { data: reqs }] = await Promise.all([
    supabase.from("contributions").select("amount_kobo, status").eq("member_id", memberId),
    supabase
      .from("product_subscriptions")
      .select("principal_kobo, funding_source, status")
      .eq("member_id", memberId),
    supabase
      .from("product_subscription_requests")
      .select("amount_kobo, funding_source, status, request_type")
      .eq("member_id", memberId),
  ]);

  const totalCompleted = (contribs ?? [])
    .filter((c) => c.status === "COMPLETED")
    .reduce((sum, c) => sum + c.amount_kobo, 0);

  const usedViaSubscriptions = (subs ?? [])
    .filter((s) => s.funding_source === "CONTRIBUTION_TRANSFER" && s.status !== "REJECTED")
    .reduce((sum, s) => sum + s.principal_kobo, 0);

  const usedViaTopups = (reqs ?? [])
    .filter((r) => r.request_type === "TOPUP" && r.funding_source === "CONTRIBUTION_TRANSFER" && r.status !== "REJECTED")
    .reduce((sum, r) => sum + r.amount_kobo, 0);

  return Math.max(0, totalCompleted - usedViaSubscriptions - usedViaTopups);
};

// ── Admin-facing reads ──────────────────────────────────────────────────────

export const fetchAllProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toProduct);
};

export interface ProductSubscriber {
  subscriptionId: string;
  memberName: string;
  memberNumber: string;
  principalKobo: number;
  currentBalanceKobo: number;
  status: SubscriptionStatus;
  investedAt: string | null;
  fundingSource: FundingSource;
  receiptUrl: string | null;
}

export const fetchProductSubscribers = async (productId: string): Promise<ProductSubscriber[]> => {
  const { data, error } = await supabase
    .from("product_subscriptions")
    .select("id, principal_kobo, current_balance_kobo, status, invested_at, funding_source, receipt_url, members(full_name, member_number)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((row) => ({
    subscriptionId: row.id,
    memberName: (row.members as unknown as { full_name: string; member_number: string } | null)?.full_name ?? "—",
    memberNumber: (row.members as unknown as { full_name: string; member_number: string } | null)?.member_number ?? "",
    principalKobo: row.principal_kobo,
    currentBalanceKobo: row.current_balance_kobo,
    status: row.status as SubscriptionStatus,
    investedAt: row.invested_at,
    fundingSource: row.funding_source as FundingSource,
    receiptUrl: row.receipt_url,
  }));
};

export interface PendingProductRequest {
  id: string;
  kind: "SUBSCRIPTION" | "TOPUP" | "WITHDRAWAL";
  memberName: string;
  memberEmail: string;
  productName: string;
  amountKobo: number;
  requestedAt: string;
  fundingSource: FundingSource | null;
  receiptUrl: string | null;
}

export const fetchPendingProductRequests = async (): Promise<PendingProductRequest[]> => {
  const [{ data: subs, error: subsError }, { data: reqs, error: reqsError }] = await Promise.all([
    supabase
      .from("product_subscriptions")
      .select("id, principal_kobo, created_at, funding_source, receipt_url, members(full_name, email), products(name)")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true }),
    supabase
      .from("product_subscription_requests")
      .select("id, request_type, amount_kobo, requested_at, funding_source, receipt_url, members(full_name, email), product_subscriptions(products(name))")
      .eq("status", "PENDING")
      .order("requested_at", { ascending: true }),
  ]);
  if (subsError) handleSupabaseError(subsError);
  if (reqsError) handleSupabaseError(reqsError);

  const fromSubs: PendingProductRequest[] = (subs ?? []).map((s) => ({
    id: s.id,
    kind: "SUBSCRIPTION",
    memberName: (s.members as unknown as { full_name: string; email: string } | null)?.full_name ?? "—",
    memberEmail: (s.members as unknown as { full_name: string; email: string } | null)?.email ?? "",
    productName: (s.products as unknown as { name: string } | null)?.name ?? "—",
    amountKobo: s.principal_kobo,
    requestedAt: s.created_at,
    fundingSource: s.funding_source as FundingSource,
    receiptUrl: s.receipt_url,
  }));

  const fromReqs: PendingProductRequest[] = (reqs ?? []).map((r) => ({
    id: r.id,
    kind: r.request_type as "TOPUP" | "WITHDRAWAL",
    memberName: (r.members as unknown as { full_name: string; email: string } | null)?.full_name ?? "—",
    memberEmail: (r.members as unknown as { full_name: string; email: string } | null)?.email ?? "",
    productName:
      (r.product_subscriptions as unknown as { products: { name: string } | null } | null)?.products?.name ?? "—",
    amountKobo: r.amount_kobo,
    requestedAt: r.requested_at,
    fundingSource: (r.funding_source as FundingSource) ?? null,
    receiptUrl: r.receipt_url,
  }));

  return [...fromSubs, ...fromReqs].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
};

// ── Admin-facing writes ─────────────────────────────────────────────────────

export const createProduct = async (params: {
  tenantId: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  icon: string;
  productType: ProductType;
  minInvestmentKobo: number;
  tenorOptions?: number[];
  status: ProductStatus;
  creditAccountInfo?: string;
}): Promise<void> => {
  const { error } = await supabase.from("products").insert({
    tenant_id: params.tenantId,
    name: params.name,
    slug: params.slug,
    tagline: params.tagline ?? null,
    description: params.description ?? null,
    icon: params.icon,
    product_type: params.productType,
    min_investment_kobo: params.minInvestmentKobo,
    tenor_options: params.tenorOptions ?? null,
    status: params.status,
    credit_account_info: params.creditAccountInfo ?? null,
  });
  if (error) handleSupabaseError(error);
};

export const updateProduct = async (
  id: string,
  updates: Partial<{
    name: string;
    tagline: string;
    description: string;
    icon: string;
    minInvestmentKobo: number;
    tenorOptions: number[];
    status: ProductStatus;
    creditAccountInfo: string;
  }>
): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.tagline !== undefined) payload.tagline = updates.tagline;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.icon !== undefined) payload.icon = updates.icon;
  if (updates.minInvestmentKobo !== undefined) payload.min_investment_kobo = updates.minInvestmentKobo;
  if (updates.tenorOptions !== undefined) payload.tenor_options = updates.tenorOptions;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.creditAccountInfo !== undefined) payload.credit_account_info = updates.creditAccountInfo;
  payload.updated_at = new Date().toISOString();

  const { error } = await supabase.from("products").update(payload).eq("id", id);
  if (error) handleSupabaseError(error);
};

export const reviewSubscription = async (subscriptionId: string, approve: boolean, reviewerId: string): Promise<void> => {
  const { error } = await supabase
    .from("product_subscriptions")
    .update({
      status: approve ? "ACTIVE" : "REJECTED",
      invested_at: approve ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);
  if (error) handleSupabaseError(error);

  if (approve) {
    const { data: sub } = await supabase
      .from("product_subscriptions")
      .select("tenant_id, principal_kobo")
      .eq("id", subscriptionId)
      .single();
    if (sub) {
      const { error: ledgerError } = await supabase.from("product_subscription_ledger").insert({
        tenant_id: sub.tenant_id,
        subscription_id: subscriptionId,
        entry_type: "INITIAL",
        balance_before_kobo: 0,
        amount_kobo: sub.principal_kobo,
        balance_after_kobo: sub.principal_kobo,
      });
      if (ledgerError) handleSupabaseError(ledgerError);
    }
  }
};

export const reviewSubscriptionRequest = async (requestId: string, approve: boolean, reviewerId: string): Promise<void> => {
  const { error } = await supabase.rpc("review_subscription_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_reviewer: reviewerId,
  });
  if (error) handleSupabaseError(error);
};

export const publishProductRate = async (productId: string, ratePercent: number, note: string): Promise<void> => {
  const { error } = await supabase.rpc("publish_product_rate", {
    p_product_id: productId,
    p_rate_percent: ratePercent,
    p_note: note,
  });
  if (error) handleSupabaseError(error);
};

// ── Notifications ────────────────────────────────────────────────────────────

export const notifyRequestSubmitted = async (params: {
  tenantId: string;
  memberName: string;
  cooperativeName: string;
  requestLabel: string;
  amountLabel: string;
}): Promise<void> => {
  await supabase.functions.invoke("send-notification", {
    body: { type: "request_submitted", ...params },
  });
};

export const notifyRequestReviewed = async (params: {
  memberEmail: string;
  memberName: string;
  cooperativeName: string;
  requestLabel: string;
  amountLabel: string;
  status: "APPROVED" | "REJECTED";
}): Promise<void> => {
  await supabase.functions.invoke("send-notification", {
    body: { type: "request_reviewed", ...params },
  });
};
