// Member self-service statement — replaces the previous pattern of fetching
// a hardcoded .limit(10) and reducing over it client-side for "totals"
// (see apps/member/src/pages/Home.tsx). Totals come from a SQL aggregate
// (get_member_statement_summary, RLS-scoped to the caller's own rows), and
// history is properly cursor-paginated instead of silently truncated.
import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export interface MemberStatementSummary {
  memberId: string;
  totalContributionsKobo: number;
  contributionCount: number;
  activeLoanCount: number;
  totalPrincipalKobo: number;
  totalRepaidKobo: number;
  totalOutstandingKobo: number;
}

export const fetchMemberStatementSummary = async (): Promise<MemberStatementSummary> => {
  const { data, error } = await supabase.rpc("get_member_statement_summary").single();
  if (error) handleSupabaseError(error);

  const row = data as {
    member_id: string;
    total_contributions_kobo: number;
    contribution_count: number;
    active_loan_count: number;
    total_principal_kobo: number;
    total_repaid_kobo: number;
    total_outstanding_kobo: number;
  };

  return {
    memberId: row.member_id,
    totalContributionsKobo: row.total_contributions_kobo,
    contributionCount: row.contribution_count,
    activeLoanCount: row.active_loan_count,
    totalPrincipalKobo: row.total_principal_kobo,
    totalRepaidKobo: row.total_repaid_kobo,
    totalOutstandingKobo: row.total_outstanding_kobo,
  };
};

export interface StatementContributionRow {
  id: string;
  amountKobo: number;
  status: string;
  channel: string;
  periodMonth: number | null;
  periodYear: number | null;
  createdAt: string;
}

export interface CursorPage<T> {
  rows: T[];
  nextCursor: string | null; // "<createdAtIso>:<id>"
}

const CONTRIBUTIONS_PAGE_SIZE = 25;

// Keyset (created_at, id) pagination — never a hardcoded .limit() silently
// truncating a long-tenured member's history.
export const fetchMemberContributionsPage = async (
  memberId: string,
  cursor?: string
): Promise<CursorPage<StatementContributionRow>> => {
  let query = supabase
    .from("contributions")
    .select("id, amount_kobo, status, channel, period_month, period_year, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CONTRIBUTIONS_PAGE_SIZE);

  if (cursor) {
    const [createdAt, id] = cursor.split("|");
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) handleSupabaseError(error);

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    amountKobo: r.amount_kobo,
    status: r.status,
    channel: r.channel,
    periodMonth: r.period_month,
    periodYear: r.period_year,
    createdAt: r.created_at,
  }));

  const last = rows[rows.length - 1];
  const nextCursor = rows.length === CONTRIBUTIONS_PAGE_SIZE && last ? `${last.createdAt}|${last.id}` : null;

  return { rows, nextCursor };
};

export interface StatementLoanRow {
  id: string;
  loanNumber: string;
  principalKobo: number;
  status: string;
  disbursedAt: string | null;
  dueDate: string | null;
  totalRepaidKobo: number;
}

// A member's own loan count is naturally small (dozens at most, not
// thousands), so a single bounded fetch is appropriate here — unlike the
// admin-side ledger/batch operations, which page through every member.
export const fetchMemberLoansWithRepayments = async (memberId: string): Promise<StatementLoanRow[]> => {
  const { data: loans, error } = await supabase
    .from("loans")
    .select("id, loan_number, principal_kobo, status, disbursed_at, due_date")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) handleSupabaseError(error);
  if (!loans || loans.length === 0) return [];

  const { data: repayments } = await supabase
    .from("loan_repayments")
    .select("loan_id, principal_portion_kobo")
    .in("loan_id", loans.map((l) => l.id));

  const repaidByLoan = new Map<string, number>();
  for (const r of repayments ?? []) {
    repaidByLoan.set(r.loan_id, (repaidByLoan.get(r.loan_id) ?? 0) + r.principal_portion_kobo);
  }

  return loans.map((l) => ({
    id: l.id,
    loanNumber: l.loan_number,
    principalKobo: l.principal_kobo,
    status: l.status,
    disbursedAt: l.disbursed_at,
    dueDate: l.due_date,
    totalRepaidKobo: repaidByLoan.get(l.id) ?? 0,
  }));
};
