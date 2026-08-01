import { supabase } from "@/lib/supabase";
import { nairaToKobo, formatMoneyFull, generatePaymentReference } from "@/lib/money";
import { handleSupabaseError, NotFoundError } from "@/lib/errors";

export interface ContributionRow {
  id: string;
  date: string;
  member: string;
  memberId: string;
  memberDbId: string;
  amount: string;
  amountKobo: number;
  channel: string;
  status: string;
  reference: string;
}

export interface RecordContributionData {
  tenantId: string;
  memberNumber: string;         // MEM-001 — looked up to get UUID
  amountNaira: number;
  channel: string;
  periodMonth?: number;
  periodYear?: number;
  notes?: string;
}

const toDisplayStatus = (s: string) => ({ COMPLETED: "Completed", PENDING: "Pending", FAILED: "Failed" }[s] ?? s);
const toDisplayChannel = (s: string) => ({
  bank_transfer: "Bank Transfer",
  cash: "Cash Deposit",
  paystack: "Paystack",
  mobile_money: "Mobile Money",
}[s] ?? s);

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchAllContributions = async (): Promise<ContributionRow[]> => {
  const { data, error } = await supabase
    .from("contributions")
    .select(`
      id,
      amount_kobo,
      channel,
      status,
      reference,
      created_at,
      member:members(member_number, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) handleSupabaseError(error);

  return (data ?? []).map((row) => {
    const m = row.member as { member_number: string; full_name: string } | null;
    return {
      id: row.id,
      date: new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      member: m?.full_name ?? "Unknown",
      memberId: m?.member_number ?? "",
      memberDbId: "",
      amount: formatMoneyFull(row.amount_kobo),
      amountKobo: row.amount_kobo,
      channel: toDisplayChannel(row.channel),
      status: toDisplayStatus(row.status),
      reference: row.reference,
    };
  });
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const recordMemberContribution = async (data: RecordContributionData): Promise<void> => {
  // Resolve member UUID from member_number
  const { data: memberRow, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("member_number", data.memberNumber)
    .single();

  if (memberError) throw new NotFoundError("Member", data.memberNumber);

  const { error } = await supabase.from("contributions").insert({
    tenant_id: data.tenantId,
    member_id: memberRow.id,
    amount_kobo: nairaToKobo(data.amountNaira),
    channel: data.channel,
    status: "COMPLETED",
    completed_at: new Date().toISOString(),
    reference: generatePaymentReference("CONTRIB"),
    period_month: data.periodMonth ?? null,
    period_year: data.periodYear ?? new Date().getFullYear(),
    notes: data.notes ?? null,
  });

  if (error) handleSupabaseError(error);
};

export const submitMemberContribution = async (data: {
  tenantId: string;
  memberId: string;
  amountNaira: number;
  channel: string;
  paidDate?: string;
  receiptNote?: string;
  notes?: string;
}): Promise<void> => {
  const parts = [
    data.paidDate ? `Payment date: ${data.paidDate}` : null,
    data.receiptNote ? `Receipt ref: ${data.receiptNote}` : null,
    data.notes || null,
  ].filter(Boolean);

  const { error } = await supabase.from("contributions").insert({
    tenant_id: data.tenantId,
    member_id: data.memberId,
    amount_kobo: nairaToKobo(data.amountNaira),
    channel: data.channel,
    status: "PENDING",
    reference: generatePaymentReference("CONTRIB"),
    notes: parts.length ? parts.join(" | ") : null,
  });
  if (error) handleSupabaseError(error);
};

export const markContributionAsCompleted = async (contributionId: string): Promise<void> => {
  const { error } = await supabase
    .from("contributions")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", contributionId);
  if (error) handleSupabaseError(error);
};

export const markContributionAsFailed = async (contributionId: string): Promise<void> => {
  const { error } = await supabase
    .from("contributions")
    .update({ status: "FAILED" })
    .eq("id", contributionId);
  if (error) handleSupabaseError(error);
};
