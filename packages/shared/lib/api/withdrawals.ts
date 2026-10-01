import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";
import { formatMoneyFull } from "../money";

export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface WithdrawalRequestRow {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  amountKobo: number;
  amount: string;
  reason: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: WithdrawalStatus;
  requestedAt: string;
  rejectionReason: string | null;
}

export interface OwnWithdrawalRequest {
  id: string;
  amountKobo: number;
  status: WithdrawalStatus;
  requestedAt: string;
  rejectionReason: string | null;
}

const toRequestRow = (r: Record<string, any>): WithdrawalRequestRow => ({
  id: r.id,
  memberId: r.member_id,
  memberName: r.member?.full_name ?? "—",
  memberNumber: r.member?.member_number ?? "—",
  amountKobo: r.amount_kobo,
  amount: formatMoneyFull(r.amount_kobo),
  reason: r.reason,
  bankName: r.bank_name,
  accountNumber: r.account_number,
  accountName: r.account_name,
  status: r.status,
  requestedAt: r.requested_at,
  rejectionReason: r.rejection_reason ?? null,
});

// ── Member: available balance ───────────────────────────────────────────────
// Completed contributions minus whatever has actually been paid out — mirrors
// get_member_contribution_balance() in Postgres, computed client-side here so
// the member app's existing direct-Supabase + RLS pattern doesn't need a new
// RPC round trip just to show a number on a form.
export const fetchMemberContributionBalance = async (memberId: string): Promise<number> => {
  const [contribRes, withdrawalRes] = await Promise.all([
    supabase.from("contributions").select("amount_kobo").eq("member_id", memberId).eq("status", "COMPLETED"),
    supabase.from("withdrawal_requests").select("amount_kobo").eq("member_id", memberId).eq("status", "PAID"),
  ]);
  if (contribRes.error) handleSupabaseError(contribRes.error);
  if (withdrawalRes.error) handleSupabaseError(withdrawalRes.error);

  const totalContributed = (contribRes.data ?? []).reduce((s, r) => s + r.amount_kobo, 0);
  const totalPaidOut = (withdrawalRes.data ?? []).reduce((s, r) => s + r.amount_kobo, 0);
  return totalContributed - totalPaidOut;
};

// ── Member: request / own history ───────────────────────────────────────────
export const requestWithdrawal = async (params: {
  tenantId: string;
  memberId: string;
  amountKobo: number;
  reason: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}): Promise<void> => {
  const { error } = await supabase.from("withdrawal_requests").insert({
    tenant_id: params.tenantId,
    member_id: params.memberId,
    amount_kobo: params.amountKobo,
    reason: params.reason,
    bank_name: params.bankName,
    account_number: params.accountNumber,
    account_name: params.accountName,
  });
  if (error) handleSupabaseError(error);
};

export const fetchOwnWithdrawalRequests = async (memberId: string): Promise<OwnWithdrawalRequest[]> => {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("id, amount_kobo, status, requested_at, rejection_reason")
    .eq("member_id", memberId)
    .order("requested_at", { ascending: false })
    .limit(10);
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    amountKobo: r.amount_kobo,
    status: r.status,
    requestedAt: r.requested_at,
    rejectionReason: r.rejection_reason ?? null,
  }));
};

// ── Admin: review queue ──────────────────────────────────────────────────────
export const fetchPendingWithdrawalRequests = async (): Promise<WithdrawalRequestRow[]> => {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*, member:members(full_name, member_number)")
    .eq("status", "PENDING")
    .order("requested_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toRequestRow);
};

export const fetchApprovedWithdrawalRequests = async (): Promise<WithdrawalRequestRow[]> => {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*, member:members(full_name, member_number)")
    .eq("status", "APPROVED")
    .order("reviewed_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toRequestRow);
};

export const reviewWithdrawalRequest = async (
  requestId: string, approve: boolean, reviewerId: string, rejectionReason?: string
): Promise<void> => {
  const { error } = await supabase.rpc("review_withdrawal_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_reviewer: reviewerId,
    p_rejection_reason: rejectionReason ?? null,
  });
  if (error) handleSupabaseError(error);
};

export const markWithdrawalPaid = async (requestId: string, paymentReference?: string): Promise<void> => {
  const { error } = await supabase.rpc("mark_withdrawal_paid", {
    p_request_id: requestId,
    p_payment_reference: paymentReference ?? null,
  });
  if (error) handleSupabaseError(error);
};
