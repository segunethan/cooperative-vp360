import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
export type KycIdType = "NIN" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD";

export interface KycSubmission {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bvn: string;
  nin: string;
  secretQuestion: string;
  secretAnswer: string;
  idType: KycIdType;
  idNumber: string;
  idExpiryDate: string;
  idDocumentUrl: string | null;
  notInOtherSociety: boolean;
  existingDebtDeclaration: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinAddress: string;
  monthlyThriftKobo: number | null;
  entranceFeeKobo: number | null;
  entranceFeeReceiptUrl: string | null;
  entranceFeePaidDate: string | null;
  signatureName: string;
  endorsedAt: string | null;
  status: KycStatus;
  rejectionReason: string | null;
  submittedAt: string;
}

export interface KycFormData {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bvn: string;
  nin: string;
  secretQuestion: string;
  secretAnswer: string;
  idType: KycIdType;
  idNumber: string;
  idExpiryDate: string;
  idDocumentUrl?: string;
  notInOtherSociety: boolean;
  existingDebtDeclaration: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinAddress: string;
  monthlyThriftKobo?: number;
  entranceFeeKobo?: number;
  entranceFeeReceiptUrl?: string;
  entranceFeePaidDate?: string;
  signatureName: string;
}

const toSubmission = (row: Record<string, unknown>): KycSubmission => ({
  id: row.id as string,
  bankName: row.bank_name as string,
  accountNumber: row.account_number as string,
  accountName: row.account_name as string,
  bvn: row.bvn as string,
  nin: (row.nin as string) ?? "",
  secretQuestion: row.secret_question as string,
  secretAnswer: row.secret_answer as string,
  idType: row.id_type as KycIdType,
  idNumber: row.id_number as string,
  idExpiryDate: row.id_expiry_date as string,
  idDocumentUrl: (row.id_document_url as string) ?? null,
  notInOtherSociety: (row.not_in_other_society as boolean) ?? false,
  existingDebtDeclaration: (row.existing_debt_declaration as string) ?? "",
  nextOfKinName: row.next_of_kin_name as string,
  nextOfKinRelationship: row.next_of_kin_relationship as string,
  nextOfKinPhone: row.next_of_kin_phone as string,
  nextOfKinAddress: row.next_of_kin_address as string,
  monthlyThriftKobo: (row.monthly_thrift_kobo as number) ?? null,
  entranceFeeKobo: (row.entrance_fee_kobo as number) ?? null,
  entranceFeeReceiptUrl: (row.entrance_fee_receipt_url as string) ?? null,
  entranceFeePaidDate: (row.entrance_fee_paid_date as string) ?? null,
  signatureName: (row.signature_name as string) ?? "",
  endorsedAt: (row.endorsed_at as string) ?? null,
  status: row.status as KycStatus,
  rejectionReason: (row.rejection_reason as string) ?? null,
  submittedAt: row.submitted_at as string,
});

// ── Member-facing ────────────────────────────────────────────────────────────

export const fetchOwnKyc = async (memberId: string): Promise<KycSubmission | null> => {
  const { data, error } = await supabase
    .from("member_kyc_submissions")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? toSubmission(data) : null;
};

export const submitKyc = async (tenantId: string, memberId: string, form: KycFormData, isResubmit: boolean): Promise<void> => {
  const payload = {
    tenant_id: tenantId,
    member_id: memberId,
    bank_name: form.bankName,
    account_number: form.accountNumber,
    account_name: form.accountName,
    bvn: form.bvn,
    nin: form.nin,
    secret_question: form.secretQuestion,
    secret_answer: form.secretAnswer,
    id_type: form.idType,
    id_number: form.idNumber,
    id_expiry_date: form.idExpiryDate,
    id_document_url: form.idDocumentUrl ?? null,
    not_in_other_society: form.notInOtherSociety,
    existing_debt_declaration: form.existingDebtDeclaration || null,
    next_of_kin_name: form.nextOfKinName,
    next_of_kin_relationship: form.nextOfKinRelationship,
    next_of_kin_phone: form.nextOfKinPhone,
    next_of_kin_address: form.nextOfKinAddress,
    monthly_thrift_kobo: form.monthlyThriftKobo ?? null,
    entrance_fee_kobo: form.entranceFeeKobo ?? null,
    entrance_fee_receipt_url: form.entranceFeeReceiptUrl ?? null,
    entrance_fee_paid_date: form.entranceFeePaidDate ?? null,
    signature_name: form.signatureName,
    endorsed_at: new Date().toISOString(),
    status: "PENDING",
    rejection_reason: null,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = isResubmit
    ? await supabase.from("member_kyc_submissions").update(payload).eq("member_id", memberId)
    : await supabase.from("member_kyc_submissions").insert(payload);
  if (error) handleSupabaseError(error);
};

// ── Admin-facing ─────────────────────────────────────────────────────────────

export interface PendingKycRow extends KycSubmission {
  memberName: string;
  memberNumber: string;
}

export const fetchPendingKyc = async (): Promise<PendingKycRow[]> => {
  const { data, error } = await supabase
    .from("member_kyc_submissions")
    .select("*, members(full_name, member_number)")
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((row) => ({
    ...toSubmission(row),
    memberName: (row.members as unknown as { full_name: string; member_number: string } | null)?.full_name ?? "—",
    memberNumber: (row.members as unknown as { full_name: string; member_number: string } | null)?.member_number ?? "",
  }));
};

export const reviewKycSubmission = async (
  submissionId: string,
  approve: boolean,
  reviewerId: string,
  rejectionReason?: string
): Promise<void> => {
  const { error } = await supabase.rpc("review_kyc_submission", {
    p_submission_id: submissionId,
    p_approve: approve,
    p_reviewer: reviewerId,
    p_rejection_reason: rejectionReason ?? null,
  });
  if (error) handleSupabaseError(error);
};
