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
