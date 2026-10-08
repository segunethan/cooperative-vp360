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
  requestedAt: r.requested_at,
  completedAt: r.completed_at ?? null,
});

// Queues a report — returns immediately. A cron worker (ticking once a
// minute) picks it up and runs the aggregation; this call never runs the
// heavy query itself, so it can't time out or tie up a connection.
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

// Flattens a completed report's JSON result into CSV rows for download —
// shape differs per report type, so each gets its own flattening.
export const reportResultToCsvRows = (reportType: ReportType, result: Record<string, any>): Record<string, unknown>[] => {
  switch (reportType) {
    case "CONTRIBUTION_SUMMARY":
      return (result.byChannel ?? []).map((r: any) => ({
        channel: r.channel, totalKobo: r.totalKobo, count: r.count,
      }));
    case "LOAN_PORTFOLIO":
      return (result.byStatus ?? []).map((r: any) => ({
        status: r.status, count: r.count, principalKobo: r.principalKobo,
      }));
    case "MEMBER_REGISTRY":
      return (result.byStatus ?? []).map((r: any) => ({
        status: r.status, count: r.count,
      }));
    case "DIVIDEND_DISTRIBUTION":
      return (result.dividends ?? [result]).map((r: any) => ({
        period: r.period, ratePct: r.ratePct, status: r.status,
        totalAmountKobo: r.totalAmountKobo, eligibleMembers: r.eligibleMembers, paidCount: r.paidCount,
      }));
    case "FINANCIAL_STATEMENT":
      return [{
        periodYear: result.periodYear,
        totalContributionsKobo: result.totalContributionsKobo,
        totalLoansDisbursedKobo: result.totalLoansDisbursedKobo,
        totalRepaymentsReceivedKobo: result.totalRepaymentsReceivedKobo,
        totalDividendsPaidKobo: result.totalDividendsPaidKobo,
        outstandingLoanPrincipalKobo: result.outstandingLoanPrincipalKobo,
      }];
    default:
      return [];
  }
};
