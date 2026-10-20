import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export type ReportType =
  | "CONTRIBUTION_SUMMARY"
  | "LOAN_PORTFOLIO"
  | "MEMBER_REGISTRY"
  | "DIVIDEND_DISTRIBUTION"
  | "FINANCIAL_STATEMENT";

export type ReportStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ReportRequestRow {
  id: string;
  reportType: ReportType;
  params: Record<string, unknown>;
  status: ReportStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  errorMessage: string | null;
  rowCount: number | null;
  requestedAt: string;
  completedAt: string | null;
}

export const reportTypeLabel: Record<ReportType, string> = {
  CONTRIBUTION_SUMMARY: "Monthly Contribution Summary",
  LOAN_PORTFOLIO: "Loan Portfolio Analysis",
  MEMBER_REGISTRY: "Member Registry Report",
  DIVIDEND_DISTRIBUTION: "Dividend Distribution Log",
  FINANCIAL_STATEMENT: "Annual Financial Statement",
};

const toRow = (r: Record<string, any>): ReportRequestRow => ({
  id: r.id,
  reportType: r.report_type,
  params: r.params ?? {},
  status: r.status,
  result: r.result,
  errorMessage: r.error_message ?? null,
  rowCount: r.row_count ?? null,
  requestedAt: r.requested_at,
  completedAt: r.completed_at ?? null,
});

// Queues a report — returns immediately. A cron worker (ticking once a
// minute) picks it up and runs the aggregation; this call never runs the
// heavy query itself, so it can't time out or tie up a connection. Param
// validation happens server-side in request_report() so a bad request
// (e.g. period_month=47) fails immediately with an actionable error
// instead of surfacing as an opaque FAILED row later.
export const requestReport = async (reportType: ReportType, params: Record<string, unknown> = {}): Promise<string> => {
  const { data, error } = await supabase.rpc("request_report", {
    p_report_type: reportType,
    p_params: params,
  });
  if (error) handleSupabaseError(error);
  return data as string;
};

export const fetchReportRequests = async (limit = 20): Promise<ReportRequestRow[]> => {
  const { data, error } = await supabase
    .from("report_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toRow);
};

export const fetchReportRequest = async (id: string): Promise<ReportRequestRow | null> => {
  const { data, error } = await supabase.from("report_requests").select("*").eq("id", id).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? toRow(data) : null;
};

// ── CSV safety ───────────────────────────────────────────────────────────────
// Standard CSV-injection mitigation (OWASP): a cell whose text begins with
// =, +, -, @, tab, or CR is treated as a formula by Excel/Sheets when the
// file is opened. Member names, loan purposes, etc. are free text an admin
// (not us) typed in, so any export that includes them needs this guard.
// Papa.unparse already handles quote/comma/newline escaping correctly —
// this only neutralizes the leading-character formula trigger.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export const sanitizeCsvCell = (value: string | number): string | number => {
  if (typeof value !== "string") return value;
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
};

export interface MemberRegistryRow {
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  kycVerified: boolean;
  joinedAt: string;
}

// Keyset-paginated — never offset pagination, which degrades as the page
// number grows and can skip/duplicate rows if records are added mid-export.
// member_number is already unique per tenant (enforced by a DB constraint),
// so it's a safe, stable cursor with no extra tie-breaker column needed.
// RLS (members_isolated: tenant_id = get_tenant_id()) scopes this to the
// caller's own tenant — there is no p_tenant_id parameter to forge.
export const fetchMemberRegistryPage = async (
  cursor?: string,
  limit = 500
): Promise<{ rows: MemberRegistryRow[]; nextCursor: string | null }> => {
  let query = supabase
    .from("members")
    .select("member_number, full_name, email, phone, status, kyc_verified, joined_at")
    .order("member_number", { ascending: true })
    .limit(limit);
  if (cursor) query = query.gt("member_number", cursor);

  const { data, error } = await query;
  if (error) handleSupabaseError(error);

  const rows = (data ?? []).map((r) => ({
    memberNumber: r.member_number,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    status: r.status,
    kycVerified: r.kyc_verified,
    joinedAt: r.joined_at,
  }));
  const nextCursor = rows.length === limit ? rows[rows.length - 1].memberNumber : null;
  return { rows, nextCursor };
};
