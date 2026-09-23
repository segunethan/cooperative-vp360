import { supabase } from "../supabase";
import { handleSupabaseError, NotFoundError } from "../errors";
import { addNewMember } from "./members";

export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TenantPublicInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface MemberApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  occupation: string | null;
  status: ApplicationStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

// ── Public (unauthenticated) ─────────────────────────────────────────────────

export const fetchTenantPublicInfo = async (slug: string): Promise<TenantPublicInfo> => {
  const { data, error } = await supabase.rpc("get_tenant_public_info", { p_slug: slug });
  if (error) handleSupabaseError(error);
  const row = data?.[0];
  if (!row) throw new NotFoundError("Cooperative", slug);
  return { id: row.id, name: row.name, logoUrl: row.logo_url ?? null };
};

export const submitMemberApplication = async (params: {
  tenantId: string;
  cooperativeName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  occupation?: string;
}): Promise<void> => {
  const { error } = await supabase.from("member_applications").insert({
    tenant_id: params.tenantId,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    email: params.email.trim().toLowerCase(),
    phone: params.phone.trim(),
    gender: params.gender || null,
    date_of_birth: params.dateOfBirth || null,
    address: params.address?.trim() || null,
    occupation: params.occupation?.trim() || null,
  });
  if (error) handleSupabaseError(error);

  await supabase.functions.invoke("send-notification", {
    body: {
      type: "application_submitted",
      tenantId: params.tenantId,
      memberName: `${params.firstName.trim()} ${params.lastName.trim()}`,
      cooperativeName: params.cooperativeName,
      applicantEmail: params.email.trim().toLowerCase(),
      applicantPhone: params.phone.trim(),
    },
  });
};

// ── Admin-facing ─────────────────────────────────────────────────────────────

const toApplication = (row: Record<string, unknown>): MemberApplication => ({
  id: row.id as string,
  firstName: row.first_name as string,
  lastName: row.last_name as string,
  email: row.email as string,
  phone: row.phone as string,
  gender: (row.gender as string) ?? null,
  dateOfBirth: (row.date_of_birth as string) ?? null,
  address: (row.address as string) ?? null,
  occupation: (row.occupation as string) ?? null,
  status: row.status as ApplicationStatus,
  rejectionReason: (row.rejection_reason as string) ?? null,
  submittedAt: row.submitted_at as string,
  reviewedAt: (row.reviewed_at as string) ?? null,
});

export const fetchPendingApplications = async (): Promise<MemberApplication[]> => {
  const { data, error } = await supabase
    .from("member_applications")
    .select("*")
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toApplication);
};

export const fetchRejectedApplications = async (): Promise<MemberApplication[]> => {
  const { data, error } = await supabase
    .from("member_applications")
    .select("*")
    .eq("status", "REJECTED")
    .order("reviewed_at", { ascending: false });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toApplication);
};

export const approveApplication = async (
  tenantId: string,
  application: MemberApplication,
  reviewerId: string
): Promise<{ memberNumber: string; fullName: string; email: string }> => {
  const member = await addNewMember(tenantId, {
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phone: application.phone,
    gender: application.gender ?? undefined,
    dateOfBirth: application.dateOfBirth ?? undefined,
    address: application.address ?? undefined,
    occupation: application.occupation ?? undefined,
  });

  const { error } = await supabase
    .from("member_applications")
    .update({ status: "APPROVED", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", application.id);
  if (error) handleSupabaseError(error);

  return member;
};

export const rejectApplication = async (applicationId: string, reviewerId: string, reason?: string): Promise<void> => {
  const { error } = await supabase
    .from("member_applications")
    .update({
      status: "REJECTED",
      rejection_reason: reason ?? null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
  if (error) handleSupabaseError(error);
};
