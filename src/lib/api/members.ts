import { supabase } from "@/lib/supabase";
import { formatMoneyFull } from "@/lib/money";
import { handleSupabaseError, NotFoundError } from "@/lib/errors";
import type { Member } from "@/components/cooperative/members/MemberDirectory";

export interface NewMemberFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  occupation?: string;
}

export interface MemberProfile {
  memberNumber: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  kycVerified: boolean;
  kycVerifiedAt: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  occupation: string | null;
  joinDate: string;
  contributionTotalKobo: number;
  contributionTotal: string;
  loanTotalKobo: number;
  loanTotal: string;
}

export interface MemberContributionHistory {
  id: string;
  date: string;
  amountKobo: number;
  amount: string;
  channel: string;
  status: string;
  reference: string;
}

export interface MemberLoanHistory {
  id: string;
  loanNumber: string;
  principalAmount: string;
  principalKobo: number;
  status: string;
  appliedDate: string;
  disbursedDate: string | null;
  dueDate: string | null;
  purpose: string;
}

// ── DB status → UI display status ────────────────────────────────────────────
const toDisplayStatus = (dbStatus: string): string => {
  const map: Record<string, string> = {
    ACTIVE: "Active",
    INVITED: "Pending",
    SUSPENDED: "Suspended",
    EXITED: "Exited",
  };
  return map[dbStatus] ?? "Pending";
};

// ── DB row → UI Member shape ──────────────────────────────────────────────────
const toUiMember = (row: Record<string, unknown>): Member => ({
  id: row.member_number as string,
  name: row.full_name as string,
  email: (row.email as string) ?? "",
  phone: (row.phone as string) ?? "",
  status: toDisplayStatus(row.status as string),
  contributionBalance: row.contribution_balance_kobo
    ? formatMoneyFull(row.contribution_balance_kobo as number)
    : "₦0",
  shareBalance: row.share_balance_kobo
    ? formatMoneyFull(row.share_balance_kobo as number)
    : "₦0",
  loanBalance: row.loan_balance_kobo
    ? formatMoneyFull(row.loan_balance_kobo as number)
    : "₦0",
  joinDate: new Date(row.joined_at as string).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  kycVerified: row.kyc_verified as boolean,
});

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchAllMembers = async (): Promise<Member[]> => {
  const { data, error } = await supabase
    .from("members")
    .select(`
      *,
      contribution_balance_kobo:contributions(amount_kobo).sum(),
      share_balance_kobo:shares(total_value_kobo).sum(),
      loan_balance_kobo:loans(principal_kobo).sum()
    `)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback: plain select without aggregation if PostgREST version doesn't support it
    const { data: plain, error: plainError } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });
    if (plainError) handleSupabaseError(plainError);
    return (plain ?? []).map(toUiMember);
  }

  return (data ?? []).map(toUiMember);
};

export const fetchActiveMembers = async (): Promise<{ memberNumber: string; name: string }[]> => {
  const { data, error } = await supabase
    .from("members")
    .select("member_number, full_name")
    .eq("status", "ACTIVE")
    .order("full_name", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((r) => ({ memberNumber: r.member_number, name: r.full_name }));
};

export const fetchMemberProfile = async (memberNumber: string): Promise<MemberProfile> => {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("member_number", memberNumber)
    .single();

  if (error) throw new NotFoundError("Member", memberNumber);

  const [contribResult, loanResult] = await Promise.all([
    supabase
      .from("contributions")
      .select("amount_kobo")
      .eq("member_id", data.id)
      .eq("status", "COMPLETED"),
    supabase
      .from("loans")
      .select("principal_kobo")
      .eq("member_id", data.id)
      .eq("status", "ACTIVE"),
  ]);

  const contributionTotalKobo = (contribResult.data ?? []).reduce((s, r) => s + r.amount_kobo, 0);
  const loanTotalKobo = (loanResult.data ?? []).reduce((s, r) => s + r.principal_kobo, 0);

  return {
    memberNumber: data.member_number,
    name: data.full_name,
    email: data.email ?? "",
    phone: data.phone ?? "",
    status: toDisplayStatus(data.status),
    kycVerified: data.kyc_verified ?? false,
    kycVerifiedAt: data.kyc_verified_at ?? null,
    gender: data.gender ?? null,
    dateOfBirth: data.date_of_birth ?? null,
    address: data.address ?? null,
    occupation: data.occupation ?? null,
    joinDate: new Date(data.joined_at ?? data.created_at).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    }),
    contributionTotalKobo,
    contributionTotal: formatMoneyFull(contributionTotalKobo),
    loanTotalKobo,
    loanTotal: formatMoneyFull(loanTotalKobo),
  };
};

export const fetchMemberContributionHistory = async (memberNumber: string): Promise<MemberContributionHistory[]> => {
  // First resolve the member's UUID
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("member_number", memberNumber)
    .single();
  if (memberError) throw new NotFoundError("Member", memberNumber);

  const { data, error } = await supabase
    .from("contributions")
    .select("id, amount_kobo, channel, status, reference, created_at")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) handleSupabaseError(error);

  const channelLabel: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    paystack: "Paystack",
    mobile_money: "Mobile Money",
  };
  const statusLabel: Record<string, string> = {
    COMPLETED: "Completed",
    PENDING: "Pending",
    FAILED: "Failed",
  };

  return (data ?? []).map((r) => ({
    id: r.id,
    date: new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    amountKobo: r.amount_kobo,
    amount: formatMoneyFull(r.amount_kobo),
    channel: channelLabel[r.channel] ?? r.channel,
    status: statusLabel[r.status] ?? r.status,
    reference: r.reference,
  }));
};

export const fetchMemberLoanHistory = async (memberNumber: string): Promise<MemberLoanHistory[]> => {
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("member_number", memberNumber)
    .single();
  if (memberError) throw new NotFoundError("Member", memberNumber);

  const { data, error } = await supabase
    .from("loans")
    .select("id, loan_number, principal_kobo, status, purpose, created_at, disbursed_at, due_date")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false });
  if (error) handleSupabaseError(error);

  const statusLabel: Record<string, string> = {
    PENDING: "Pending Review",
    APPROVED: "Approved",
    ACTIVE: "Active",
    REPAID: "Repaid",
    DEFAULTED: "Defaulted",
    REJECTED: "Rejected",
  };

  return (data ?? []).map((r) => ({
    id: r.id,
    loanNumber: r.loan_number,
    principalAmount: formatMoneyFull(r.principal_kobo),
    principalKobo: r.principal_kobo,
    status: statusLabel[r.status] ?? r.status,
    appliedDate: new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    disbursedDate: r.disbursed_at
      ? new Date(r.disbursed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : null,
    dueDate: r.due_date
      ? new Date(r.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : null,
    purpose: r.purpose ?? "—",
  }));
};

export const fetchMemberByNumber = async (memberNumber: string) => {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("member_number", memberNumber)
    .single();
  if (error) handleSupabaseError(error);
  return toUiMember(data!);
};

// ── Writes ───────────────────────────────────────────────────────────────────

export interface NewMemberResult {
  memberNumber: string;
  fullName: string;
  email: string;
}

export const addNewMember = async (
  tenantId: string,
  data: NewMemberFormData
): Promise<NewMemberResult> => {
  const { data: inserted, error } = await supabase
    .from("members")
    .insert({
      tenant_id: tenantId,
      full_name: `${data.firstName.trim()} ${data.lastName.trim()}`,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      gender: data.gender ?? null,
      date_of_birth: data.dateOfBirth ?? null,
      address: data.address ?? null,
      occupation: data.occupation ?? null,
      status: "INVITED",
    })
    .select("member_number, full_name, email")
    .single();

  if (error) handleSupabaseError(error);

  return {
    memberNumber: inserted!.member_number,
    fullName: inserted!.full_name,
    email: inserted!.email,
  };
};

export const sendMemberInviteEmail = async (
  memberNumber: string,
  memberName: string,
  memberEmail: string,
  cooperativeName: string,
  cooperativeNumber?: string | null
): Promise<void> => {
  const redirectTo = `${window.location.origin}/accept-invite`;
  const { error } = await supabase.functions.invoke("invite-member", {
    body: { memberNumber, memberName, memberEmail, cooperativeName, cooperativeNumber: cooperativeNumber ?? null, redirectTo },
  });
  if (error) throw new Error(error.message);
};

export const approveMemberApplication = async (memberNumber: string): Promise<void> => {
  const { error } = await supabase
    .from("members")
    .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
    .eq("member_number", memberNumber);
  if (error) handleSupabaseError(error);
};

export const suspendMember = async (memberNumber: string): Promise<void> => {
  const { error } = await supabase
    .from("members")
    .update({ status: "SUSPENDED", updated_at: new Date().toISOString() })
    .eq("member_number", memberNumber);
  if (error) handleSupabaseError(error);
};

export const exitMember = async (memberNumber: string): Promise<void> => {
  const { error } = await supabase
    .from("members")
    .update({ status: "EXITED", updated_at: new Date().toISOString() })
    .eq("member_number", memberNumber);
  if (error) handleSupabaseError(error);
};

export const markMemberKycVerified = async (memberNumber: string): Promise<void> => {
  const { error } = await supabase
    .from("members")
    .update({
      kyc_verified: true,
      kyc_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("member_number", memberNumber);
  if (error) handleSupabaseError(error);
};
