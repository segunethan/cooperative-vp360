import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";
import { formatMoneyFull, koboToNaira } from "../money";

export interface DividendRow {
  id: string;
  period: string;
  ratePct: number;
  totalAmountKobo: number;
  totalAmount: string;
  eligibleMembers: number;
  qualificationDate: string | null;
  payoutDate: string | null;
  status: string;
  declaredAt: string | null;
  createdAt: string;
}

export interface DividendEntitlement {
  id: string;
  memberNumber: string;
  memberName: string;
  contributionTotalKobo: number;
  contributionTotal: string;
  entitlementKobo: number;
  entitlement: string;
  paidAt: string | null;
}

export interface MemberDividendRow {
  id: string;
  period: string;
  ratePct: number;
  entitlementKobo: number;
  entitlement: string;
  payoutDate: string | null;
  paidAt: string | null;
}

export interface MemberContributionSummary {
  memberId: string;
  memberNumber: string;
  memberName: string;
  totalKobo: number;
}

export interface DeclareDividendData {
  tenantId: string;
  period: string;
  ratePercent: number;
  qualificationDate: string;
  payoutDate?: string;
  declaredBy: string;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchAllDividends = async (): Promise<DividendRow[]> => {
  const { data, error } = await supabase
    .from("dividends")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);

  return (data ?? []).map((r) => ({
    id: r.id,
    period: r.period,
    ratePct: r.rate_bps / 100,
    totalAmountKobo: r.total_amount_kobo,
    totalAmount: formatMoneyFull(r.total_amount_kobo),
    eligibleMembers: r.eligible_members,
    qualificationDate: r.qualification_date ?? null,
    payoutDate: r.payout_date ?? null,
    status: r.status,
    declaredAt: r.declared_at
      ? new Date(r.declared_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : null,
    createdAt: new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  }));
};

export const fetchDividendEntitlements = async (dividendId: string): Promise<DividendEntitlement[]> => {
  const { data, error } = await supabase
    .from("dividend_entitlements")
    .select("id, share_balance_kobo, entitlement_kobo, paid_at, member:members(member_number, full_name)")
    .eq("dividend_id", dividendId)
    .order("entitlement_kobo", { ascending: false });
  if (error) handleSupabaseError(error);

  return (data ?? []).map((r) => {
    const m = r.member as unknown as { member_number: string; full_name: string } | null;
    return {
      id: r.id,
      memberNumber: m?.member_number ?? "",
      memberName: m?.full_name ?? "Unknown",
      contributionTotalKobo: r.share_balance_kobo,
      contributionTotal: formatMoneyFull(r.share_balance_kobo),
      entitlementKobo: r.entitlement_kobo,
      entitlement: formatMoneyFull(r.entitlement_kobo),
      paidAt: r.paid_at
        ? new Date(r.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : null,
    };
  });
};

// A member's own dividend history — used by both the admin's per-member
// profile view and the member app itself (RLS scopes each to its own rows).
export const fetchMemberDividendHistory = async (memberId: string): Promise<MemberDividendRow[]> => {
  const { data, error } = await supabase
    .from("dividend_entitlements")
    .select("id, entitlement_kobo, paid_at, dividend:dividends(period, rate_bps, payout_date)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);

  return (data ?? []).map((r) => {
    const d = r.dividend as unknown as { period: string; rate_bps: number; payout_date: string | null } | null;
    return {
      id: r.id,
      period: d?.period ?? "—",
      ratePct: (d?.rate_bps ?? 0) / 100,
      entitlementKobo: r.entitlement_kobo,
      entitlement: formatMoneyFull(r.entitlement_kobo),
      payoutDate: d?.payout_date ?? null,
      paidAt: r.paid_at
        ? new Date(r.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : null,
    };
  });
};

// Preview: compute per-member entitlements before committing
export const previewDividend = async (
  tenantId: string,
  ratePercent: number,
  qualificationDate: string
): Promise<MemberContributionSummary[]> => {
  // Fetch all ACTIVE members for this tenant
  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("id, member_number, full_name")
    .eq("tenant_id", tenantId)
    .eq("status", "ACTIVE");
  if (memberError) handleSupabaseError(memberError);
  if (!members || members.length === 0) return [];

  // Fetch COMPLETED contributions up to and including the qualification date
  const { data: contribs, error: contribError } = await supabase
    .from("contributions")
    .select("member_id, amount_kobo")
    .eq("tenant_id", tenantId)
    .eq("status", "COMPLETED")
    .lte("created_at", `${qualificationDate}T23:59:59.999Z`);
  if (contribError) handleSupabaseError(contribError);

  // Sum contributions per member
  const totals = new Map<string, number>();
  for (const c of contribs ?? []) {
    totals.set(c.member_id, (totals.get(c.member_id) ?? 0) + c.amount_kobo);
  }

  // Only members with at least one contribution qualify
  return members
    .filter((m) => (totals.get(m.id) ?? 0) > 0)
    .map((m) => ({
      memberId: m.id,
      memberNumber: m.member_number,
      memberName: m.full_name,
      totalKobo: totals.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.totalKobo - a.totalKobo);
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const declareDividend = async (
  data: DeclareDividendData,
  qualifying: MemberContributionSummary[]
): Promise<void> => {
  const rateBps = Math.round(data.ratePercent * 100);

  const entitlements = qualifying.map((m) => ({
    kobo: Math.floor((m.totalKobo * rateBps) / 10_000), // totalKobo * rate% / 100
    memberId: m.memberId,
    totalKobo: m.totalKobo,
  }));

  const totalAmountKobo = entitlements.reduce((sum, e) => sum + e.kobo, 0);

  // 1. Insert the dividend record
  const { data: dividend, error: divError } = await supabase
    .from("dividends")
    .insert({
      tenant_id: data.tenantId,
      period: data.period.trim(),
      rate_bps: rateBps,
      total_amount_kobo: totalAmountKobo,
      eligible_members: qualifying.length,
      qualification_date: data.qualificationDate,
      payout_date: data.payoutDate ?? null,
      status: "DECLARED",
      declared_by: data.declaredBy,
      declared_at: new Date().toISOString(),
      calculation_method: "per_contribution",
    })
    .select("id")
    .single();
  if (divError) handleSupabaseError(divError);

  // 2. Insert entitlements in one batch
  const entitlementRows = entitlements.map((e) => ({
    tenant_id: data.tenantId,
    dividend_id: dividend!.id,
    member_id: e.memberId,
    share_balance_kobo: e.totalKobo,
    entitlement_kobo: e.kobo,
  }));

  const { error: entError } = await supabase
    .from("dividend_entitlements")
    .insert(entitlementRows);
  if (entError) handleSupabaseError(entError);
};

// Pays out every unpaid entitlement on this dividend in one step and marks
// the dividend COMPLETED — this is the step that makes it count toward the
// dashboard's "Dividends Paid" figure and show as paid to members.
export const markDividendPaid = async (dividendId: string, reference?: string): Promise<void> => {
  const { error } = await supabase.rpc("mark_dividend_paid", {
    p_dividend_id: dividendId,
    p_reference: reference ?? null,
  });
  if (error) handleSupabaseError(error);
};

export const formatDividendRate = (ratePct: number) => `${ratePct.toFixed(2)}%`;
export const formatDividendNaira = (kobo: number) => `₦${koboToNaira(kobo).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
