import { supabase } from "../supabase";
import { nairaToKobo, formatMoneyFull, generatePaymentReference } from "../money";
import { handleSupabaseError, NotFoundError } from "../errors";

export interface LoanApplicationRow {
  id: string;
  loanNumber: string;
  member: string;
  memberNumber: string;
  principalAmount: string;
  principalKobo: number;
  interestRatePercent: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  appliedDate: string;
}

export interface ActiveLoanRow extends LoanApplicationRow {
  dueDate: string;
  disbursedDate: string;
}

export interface SubmitLoanApplicationData {
  tenantId: string;
  memberNumber: string;
  principalNaira: number;
  interestRatePercent: number;
  tenureMonths: number;
  purpose?: string;
  notes?: string;
}

const toDisplayStatus = (s: string): string => ({
  PENDING:   "Pending Review",
  APPROVED:  "Approved",
  ACTIVE:    "Active",
  REPAID:    "Repaid",
  DEFAULTED: "Defaulted",
  REJECTED:  "Rejected",
}[s] ?? s);

const bpsToPercent = (bps: number) => bps / 100;

const toApplicationRow = (row: Record<string, unknown>): LoanApplicationRow => {
  const m = row.member as { member_number: string; full_name: string } | null;
  return {
    id: row.id as string,
    loanNumber: row.loan_number as string,
    member: m?.full_name ?? "Unknown",
    memberNumber: m?.member_number ?? "",
    principalAmount: formatMoneyFull(row.principal_kobo as number),
    principalKobo: row.principal_kobo as number,
    interestRatePercent: bpsToPercent(row.interest_rate_bps as number),
    tenureMonths: row.tenure_months as number,
    purpose: (row.purpose as string) ?? "",
    status: toDisplayStatus(row.status as string),
    appliedDate: new Date(row.created_at as string).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    }),
  };
};

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchPendingLoanApplications = async (): Promise<LoanApplicationRow[]> => {
  const { data, error } = await supabase
    .from("loans")
    .select(`id, loan_number, principal_kobo, interest_rate_bps, tenure_months, purpose, status, created_at, member:members(member_number, full_name)`)
    .in("status", ["PENDING", "APPROVED"])
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toApplicationRow);
};

export const fetchActiveLoans = async (): Promise<ActiveLoanRow[]> => {
  const { data, error } = await supabase
    .from("loans")
    .select(`id, loan_number, principal_kobo, interest_rate_bps, tenure_months, purpose, status, due_date, disbursed_at, created_at, member:members(member_number, full_name)`)
    .eq("status", "ACTIVE")
    .order("due_date", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((row) => ({
    ...toApplicationRow(row),
    dueDate: row.due_date
      ? new Date(row.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—",
    disbursedDate: row.disbursed_at
      ? new Date(row.disbursed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—",
  }));
};

export const fetchAllLoans = async (): Promise<LoanApplicationRow[]> => {
  const { data, error } = await supabase
    .from("loans")
    .select(`id, loan_number, principal_kobo, interest_rate_bps, tenure_months, purpose, status, created_at, member:members(member_number, full_name)`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toApplicationRow);
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const submitLoanApplication = async (data: SubmitLoanApplicationData): Promise<void> => {
  const { data: memberRow, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("member_number", data.memberNumber)
    .single();
  if (memberError) throw new NotFoundError("Member", data.memberNumber);

  // loan_number is assigned by the assign_loan_number_trigger in the DB —
  // no client-side count needed, no race condition.
  const { error } = await supabase.from("loans").insert({
    tenant_id: data.tenantId,
    member_id: memberRow.id,
    principal_kobo: nairaToKobo(data.principalNaira),
    interest_rate_bps: Math.round(data.interestRatePercent * 100),
    tenure_months: data.tenureMonths,
    purpose: data.purpose ?? null,
    notes: data.notes ?? null,
    status: "PENDING",
  });
  if (error) handleSupabaseError(error);
};

export const approveLoanApplication = async (loanId: string, approverId: string): Promise<void> => {
  const { error } = await supabase
    .from("loans")
    .update({
      status: "APPROVED",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", loanId);
  if (error) handleSupabaseError(error);
};

export const rejectLoanApplication = async (loanId: string): Promise<void> => {
  const { error } = await supabase
    .from("loans")
    .update({ status: "REJECTED", updated_at: new Date().toISOString() })
    .eq("id", loanId);
  if (error) handleSupabaseError(error);
};

export const disburseLoanToMember = async (loanId: string, paystackRef?: string): Promise<void> => {
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 12);
  const { error } = await supabase
    .from("loans")
    .update({
      status: "ACTIVE",
      disbursed_at: new Date().toISOString(),
      due_date: dueDate.toISOString().split("T")[0],
      paystack_reference: paystackRef ?? generatePaymentReference("DISB"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", loanId);
  if (error) handleSupabaseError(error);
};

// ── Repayment ledger ─────────────────────────────────────────────────────────

export interface LoanLedgerRow {
  id: string;
  date: string;
  type: "DISBURSEMENT" | "REPAYMENT" | "TOPUP";
  amountKobo: number;
  principalPortionKobo: number;
  interestPortionKobo: number;
  balanceBeforeKobo: number;
  balanceAfterKobo: number;
}

export const fetchLoanLedger = async (loanId: string): Promise<LoanLedgerRow[]> => {
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("principal_kobo, disbursed_at, created_at")
    .eq("id", loanId)
    .single();
  if (loanError) handleSupabaseError(loanError);

  const [{ data: repayments, error: repaymentsError }, { data: topups, error: topupsError }] = await Promise.all([
    supabase
      .from("loan_repayments")
      .select("id, amount_kobo, principal_portion_kobo, interest_portion_kobo, paid_at")
      .eq("loan_id", loanId)
      .order("paid_at", { ascending: true }),
    supabase
      .from("loan_topup_requests")
      .select("id, amount_kobo, reviewed_at")
      .eq("loan_id", loanId)
      .eq("status", "APPROVED")
      .order("reviewed_at", { ascending: true }),
  ]);
  if (repaymentsError) handleSupabaseError(repaymentsError);
  if (topupsError) handleSupabaseError(topupsError);

  type Event = { date: string; type: "REPAYMENT" | "TOPUP"; id: string; amountKobo: number; principalPortionKobo: number; interestPortionKobo: number };

  const events: Event[] = [
    ...(repayments ?? []).map((r) => ({
      date: r.paid_at as string,
      type: "REPAYMENT" as const,
      id: r.id as string,
      amountKobo: r.amount_kobo as number,
      principalPortionKobo: r.principal_portion_kobo as number,
      interestPortionKobo: r.interest_portion_kobo as number,
    })),
    ...(topups ?? []).map((t) => ({
      date: t.reviewed_at as string,
      type: "TOPUP" as const,
      id: t.id as string,
      amountKobo: t.amount_kobo as number,
      principalPortionKobo: -(t.amount_kobo as number), // increases outstanding
      interestPortionKobo: 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const rows: LoanLedgerRow[] = [];
  let balance = 0;

  const disbursementDate = (loan?.disbursed_at as string) ?? (loan?.created_at as string);
  rows.push({
    id: "disbursement",
    date: disbursementDate,
    type: "DISBURSEMENT",
    amountKobo: loan?.principal_kobo ?? 0,
    principalPortionKobo: loan?.principal_kobo ?? 0,
    interestPortionKobo: 0,
    balanceBeforeKobo: 0,
    balanceAfterKobo: loan?.principal_kobo ?? 0,
  });
  balance = loan?.principal_kobo ?? 0;

  for (const e of events) {
    const balanceBefore = balance;
    // repayments reduce outstanding by their principal portion; top-ups increase it
    balance = e.type === "REPAYMENT" ? balance - e.principalPortionKobo : balance + e.amountKobo;
    rows.push({
      id: e.id,
      date: e.date,
      type: e.type,
      amountKobo: e.amountKobo,
      principalPortionKobo: e.type === "REPAYMENT" ? e.principalPortionKobo : e.amountKobo,
      interestPortionKobo: e.interestPortionKobo,
      balanceBeforeKobo: balanceBefore,
      balanceAfterKobo: balance,
    });
  }

  return rows;
};

export const recordLoanRepayment = async (
  loanId: string,
  amountKobo: number,
  channel: string,
  paidAt: string
): Promise<void> => {
  const { error } = await supabase.rpc("record_loan_repayment", {
    p_loan_id: loanId,
    p_amount_kobo: amountKobo,
    p_channel: channel,
    p_paid_at: paidAt,
    p_reference: generatePaymentReference("REPAY"),
  });
  if (error) handleSupabaseError(error);
};

export const requestLoanTopup = async (params: {
  tenantId: string;
  loanId: string;
  memberId: string;
  amountKobo: number;
  notes?: string;
}): Promise<void> => {
  const { error } = await supabase.from("loan_topup_requests").insert({
    tenant_id: params.tenantId,
    loan_id: params.loanId,
    member_id: params.memberId,
    amount_kobo: params.amountKobo,
    notes: params.notes ?? null,
  });
  if (error) handleSupabaseError(error);
};

export const fetchPendingLoanTopups = async (): Promise<
  { id: string; loanNumber: string; memberName: string; amountKobo: number; requestedAt: string }[]
> => {
  const { data, error } = await supabase
    .from("loan_topup_requests")
    .select("id, amount_kobo, requested_at, loans(loan_number), members(full_name)")
    .eq("status", "PENDING")
    .order("requested_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    loanNumber: (r.loans as unknown as { loan_number: string } | null)?.loan_number ?? "—",
    memberName: (r.members as unknown as { full_name: string } | null)?.full_name ?? "—",
    amountKobo: r.amount_kobo,
    requestedAt: r.requested_at,
  }));
};

export const reviewLoanTopup = async (requestId: string, approve: boolean, reviewerId: string): Promise<void> => {
  const { error } = await supabase.rpc("review_loan_topup", {
    p_request_id: requestId,
    p_approve: approve,
    p_reviewer: reviewerId,
  });
  if (error) handleSupabaseError(error);
};
