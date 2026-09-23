import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export type TenantStatus =
  | "PENDING_EMAIL_VERIFICATION"
  | "EMAIL_VERIFIED"
  | "KYB_SUBMITTED"
  | "ACTIVE"
  | "KYB_REJECTED"
  | "SUSPENDED";

export interface KybSubmission {
  name: string;
  rcNumber: string | null;
  address: string | null;
  phone: string | null;
  entranceFeeKobo: number | null;
  bankAccountInfo: string | null;
  cacCertificateUrl: string | null;
  authorizedSignatoryName: string | null;
  status: TenantStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface KybFormData {
  name: string;
  rcNumber: string;
  address: string;
  phone: string;
  entranceFeeKobo?: number;
  bankAccountInfo: string;
  cacCertificateUrl?: string;
  authorizedSignatoryName: string;
}

const toSubmission = (row: Record<string, unknown>): KybSubmission => ({
  name: row.name as string,
  rcNumber: (row.rc_number as string) ?? null,
  address: (row.address as string) ?? null,
  phone: (row.phone as string) ?? null,
  entranceFeeKobo: (row.entrance_fee_kobo as number) ?? null,
  bankAccountInfo: (row.bank_account_info as string) ?? null,
  cacCertificateUrl: (row.cac_certificate_url as string) ?? null,
  authorizedSignatoryName: (row.authorized_signatory_name as string) ?? null,
  status: row.status as TenantStatus,
  rejectionReason: (row.kyb_rejection_reason as string) ?? null,
  submittedAt: (row.kyb_submitted_at as string) ?? null,
  reviewedAt: (row.kyb_reviewed_at as string) ?? null,
});

export const fetchOwnKyb = async (tenantId: string): Promise<KybSubmission | null> => {
  const { data, error } = await supabase
    .from("tenants")
    .select("name, rc_number, address, phone, entrance_fee_kobo, bank_account_info, cac_certificate_url, authorized_signatory_name, status, kyb_rejection_reason, kyb_submitted_at, kyb_reviewed_at")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? toSubmission(data) : null;
};

export const submitKyb = async (tenantId: string, form: KybFormData): Promise<void> => {
  const { error } = await supabase
    .from("tenants")
    .update({
      name: form.name.trim(),
      rc_number: form.rcNumber.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      entrance_fee_kobo: form.entranceFeeKobo ?? null,
      bank_account_info: form.bankAccountInfo.trim() || null,
      cac_certificate_url: form.cacCertificateUrl ?? null,
      authorized_signatory_name: form.authorizedSignatoryName.trim(),
      status: "KYB_SUBMITTED",
      kyb_submitted_at: new Date().toISOString(),
      kyb_rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  if (error) handleSupabaseError(error);
};
