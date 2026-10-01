import { supabase } from "../supabase";
import { nairaToKobo, formatMoneyFull, generatePaymentReference } from "../money";
import { handleSupabaseError, NotFoundError } from "../errors";
import type { LoanPrepaymentStrategy } from "./loanTypes";

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
  loanTypeName: string;
}

export interface ActiveLoanRow extends LoanApplicationRow {
  dueDate: string;
  disbursedDate: string;
  repaidKobo: number;
  outstandingKobo: number;
}

export interface SubmitLoanApplicationData {
  tenantId: string;
  memberNumber: string;
  loanTypeId: string;
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
  const lt = row.loan_type as { name: string } | null;
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
    loanTypeName: lt?.name ?? "Custom",
  };
};

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchPendingLoanApplications = async (): Promise<LoanApplicationRow[]> => {
  const { data, error } = await supabase
    .from("loans")
    .select(`id, loan_number, principal_kobo, interest_rate_bps, tenure_months, purpose, status, created_at, member:members(member_number, full_name), loan_type:loan_types(name)`)
    .in("status", ["PENDING", "APPROVED"])
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toApplicationRow);
};

export const fetchActiveLoans = async (): Promise<ActiveLoanRow[]> => {
  const { data, error } = await supabase
    .from("loans")
    .select(`id, loan_number, principal_kobo, interest_rate_bps, tenure_months, purpose, status, due_date, disbursed_at, created_at, member:members(member_number, full_name), loan_type:loan_types(name)`)
    .eq("status", "ACTIVE")
    .order("due_date", { ascending: true });
  if (error) handleSupabaseError(error);

  const loans = data ?? [];
  const loanIds = loans.map((l) => l.id);

  // Repaid/outstanding come from loan_repayments directly rather than the
  // installment schedule, so these columns stay correct even for a loan
  // whose schedule predates this feature or was never (re)generated.
  const repaidByLoan = new Map<string, { totalKobo: number; principalKobo: number }>();
  if (loanIds.length > 0) {
    const { data: repayments, error: repayError } = await supabase
      .from("loan_repayments")
      .select("loan_id, amount_kobo, principal_portion_kobo")
      .in("loan_id", loanIds);
    if (repayError) handleSupabaseError(repayError);
    for (const r of repayments ?? []) {
      const entry = repaidByLoan.get(r.loan_id) ?? { totalKobo: 0, principalKobo: 0 };
      entry.totalKobo += r.amount_kobo;
      entry.principalKobo += r.principal_portion_kobo;
      repaidByLoan.set(r.loan_id, entry);
    }
  }

  return loans.map((row) => {
    const repaid = repaidByLoan.get(row.id) ?? { totalKobo: 0, principalKobo: 0 };
    return {
      ...toApplicationRow(row),
      dueDate: row.due_date
        ? new Date(row.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "—",
      disbursedDate: row.disbursed_at
        ? new Date(row.disbursed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "—",
      repaidKobo: repaid.totalKobo,
      outstandingKobo: Math.max(row.principal_kobo - repaid.principalKobo, 0),
    };
  });
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
  // no client-side count needed, no race condition. interest_rate_bps and
  // tenure_months below are enforced server-side from loan_type_id by
  // trg_apply_loan_type_terms, regardless of what's sent here — they're
  // still computed client-side purely so the UI can show an accurate
  // estimate before submitting.
  const { error } = await supabase.from("loans").insert({
    tenant_id: data.tenantId,
    member_id: memberRow.id,
    loan_type_id: data.loanTypeId,
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
  // due_date must track the loan's own tenure — it was previously hardcoded
  // to 12 months regardless of what the borrower actually agreed to.
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("tenure_months")
    .eq("id", loanId)
    .single();
  if (loanError) handleSupabaseError(loanError);

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + (loan?.tenure_months ?? 12));

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

export interface LoanScheduleRow {
  installmentNumber: number;
  dueDate: string;
  openingBalanceKobo: number;
  principalDueKobo: number;
  interestDueKobo: number;
  installmentAmountKobo: number;
  closingBalanceKobo: number;
  paidAmountKobo: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  isOverdue: boolean;
  daysPastDue: number;
  estimatedPenaltyKobo: number;
}

// The fixed amortization plan generated at disbursement (see
// generate_loan_schedule() / the loans_generate_schedule_on_disburse
// trigger), reprojected after any prepayment by recompute_loan_schedule().
// RLS scopes this the same way for both callers: an admin sees any loan in
// their tenant, a member sees only their own loan's schedule.
//
// Overdue status, days-past-due, and the penalty estimate are all computed
// here at read time rather than stored — "overdue" is inherently a
// function of today's date, so recalculating it is more correct than a
// stored flag that would need a cron to keep fresh, and avoids needing one
// at all. The penalty is informational only in this pass: it is not yet
// folded into what record_loan_repayment() requires to mark an
// installment PAID.
export const fetchLoanSchedule = async (loanId: string): Promise<LoanScheduleRow[]> => {
  const { data, error } = await supabase
    .from("loan_installments")
    .select("installment_number, due_date, opening_balance_kobo, principal_due_kobo, interest_due_kobo, installment_amount_kobo, closing_balance_kobo, paid_amount_kobo, status, loans(late_penalty_bps_per_month)")
    .eq("loan_id", loanId)
    .order("installment_number", { ascending: true });
  if (error) handleSupabaseError(error);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return (data ?? []).map((r) => {
    const isOverdue = r.status !== "PAID" && r.due_date < todayStr;
    const daysPastDue = isOverdue
      ? Math.max(Math.floor((today.getTime() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24)), 0)
      : 0;
    const penaltyBps = (r.loans as unknown as { late_penalty_bps_per_month: number | null } | null)?.late_penalty_bps_per_month;
    const outstandingOnInstallment = r.installment_amount_kobo - r.paid_amount_kobo;
    const estimatedPenaltyKobo = isOverdue && penaltyBps
      ? Math.round(outstandingOnInstallment * (penaltyBps / 10000) * (daysPastDue / 30))
      : 0;

    return {
      installmentNumber: r.installment_number,
      dueDate: r.due_date,
      openingBalanceKobo: r.opening_balance_kobo,
      principalDueKobo: r.principal_due_kobo,
      interestDueKobo: r.interest_due_kobo,
      installmentAmountKobo: r.installment_amount_kobo,
      closingBalanceKobo: r.closing_balance_kobo,
      paidAmountKobo: r.paid_amount_kobo,
      status: r.status,
      isOverdue,
      daysPastDue,
      estimatedPenaltyKobo,
    };
  });
};

// "What would it cost to close this loan today" — outstanding principal
// plus interest accrued since the last fully-settled point, NOT the sum of
// remaining scheduled installments (which overcounts: those include
// interest on money that hasn't been owed that long yet).
export const fetchEarlyPayoffQuote = async (loanId: string): Promise<number> => {
  const { data, error } = await supabase.rpc("calculate_early_payoff", { p_loan_id: loanId });
  if (error) handleSupabaseError(error);
  return (data as number) ?? 0;
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

// ── Member-submitted repayment requests ────────────────────────────────────
// Mirrors requestLoanTopup/reviewLoanTopup below: a member reports a
// repayment they made, an admin reviews it, and approval posts the actual
// repayment through record_loan_repayment() — the same function the admin's
// own "Record Repayment" dialog already uses.

export const requestLoanRepayment = async (params: {
  tenantId: string;
  loanId: string;
  memberId: string;
  amountKobo: number;
  channel: string;
  paidAt: string; // yyyy-mm-dd
  notes?: string;
}): Promise<void> => {
  const { error } = await supabase.from("loan_repayment_requests").insert({
    tenant_id: params.tenantId,
    loan_id: params.loanId,
    member_id: params.memberId,
    amount_kobo: params.amountKobo,
    channel: params.channel,
    paid_at: params.paidAt,
    notes: params.notes ?? null,
  });
  if (error) handleSupabaseError(error);
};

export interface PendingRepaymentRequestRow {
  id: string;
  loanNumber: string;
  memberName: string;
  amountKobo: number;
  channel: string;
  paidAt: string;
  requestedAt: string;
}

export const fetchPendingLoanRepaymentRequests = async (): Promise<PendingRepaymentRequestRow[]> => {
  const { data, error } = await supabase
    .from("loan_repayment_requests")
    .select("id, amount_kobo, channel, paid_at, requested_at, loans(loan_number), members(full_name)")
    .eq("status", "PENDING")
    .order("requested_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    loanNumber: (r.loans as unknown as { loan_number: string } | null)?.loan_number ?? "—",
    memberName: (r.members as unknown as { full_name: string } | null)?.full_name ?? "—",
    amountKobo: r.amount_kobo,
    channel: r.channel,
    paidAt: r.paid_at,
    requestedAt: r.requested_at,
  }));
};

export const reviewLoanRepaymentRequest = async (requestId: string, approve: boolean, reviewerId: string): Promise<void> => {
  const { error } = await supabase.rpc("review_loan_repayment_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_reviewer: reviewerId,
  });
  if (error) handleSupabaseError(error);
};

// Member's own pending requests for a given loan, so LoanDetail.tsx can show
// "awaiting review" instead of leaving the member wondering what happened.
export const fetchOwnPendingRepaymentRequests = async (loanId: string): Promise<{ id: string; amountKobo: number; paidAt: string }[]> => {
  const { data, error } = await supabase
    .from("loan_repayment_requests")
    .select("id, amount_kobo, paid_at")
    .eq("loan_id", loanId)
    .eq("status", "PENDING")
    .order("requested_at", { ascending: false });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => ({ id: r.id, amountKobo: r.amount_kobo, paidAt: r.paid_at }));
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
  { id: string; loanId: string; loanNumber: string; memberName: string; amountKobo: number; requestedAt: string; defaultStrategy: LoanPrepaymentStrategy }[]
> => {
  const { data, error } = await supabase
    .from("loan_topup_requests")
    .select("id, amount_kobo, requested_at, loans(id, loan_number, prepayment_strategy), members(full_name)")
    .eq("status", "PENDING")
    .order("requested_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => {
    const loan = r.loans as unknown as { id: string; loan_number: string; prepayment_strategy: LoanPrepaymentStrategy } | null;
    return {
      id: r.id,
      loanId: loan?.id ?? "",
      loanNumber: loan?.loan_number ?? "—",
      memberName: (r.members as unknown as { full_name: string } | null)?.full_name ?? "—",
      amountKobo: r.amount_kobo,
      requestedAt: r.requested_at,
      defaultStrategy: loan?.prepayment_strategy ?? "REDUCE_TENURE",
    };
  });
};

export const reviewLoanTopup = async (
  requestId: string,
  approve: boolean,
  reviewerId: string,
  strategy?: LoanPrepaymentStrategy
): Promise<void> => {
  const { error } = await supabase.rpc("review_loan_topup", {
    p_request_id: requestId,
    p_approve: approve,
    p_reviewer: reviewerId,
    p_strategy: strategy ?? null,
  });
  if (error) handleSupabaseError(error);
};

export interface LoanTopupPreview {
  newInstallmentKobo: number;
  newRemainingMonths: number;
  newFinalDueDate: string;
}

// Lets the admin see the new monthly amount (or new end date) under either
// strategy before actually approving — read-only, mutates nothing.
export const previewLoanTopup = async (requestId: string, strategy: LoanPrepaymentStrategy): Promise<LoanTopupPreview | null> => {
  const { data, error } = await supabase
    .rpc("preview_loan_topup", { p_request_id: requestId, p_strategy: strategy })
    .single();
  if (error) handleSupabaseError(error);
  if (!data) return null;
  const row = data as { new_installment_kobo: number; new_remaining_months: number; new_final_due_date: string };
  return {
    newInstallmentKobo: row.new_installment_kobo,
    newRemainingMonths: row.new_remaining_months,
    newFinalDueDate: row.new_final_due_date,
  };
};
