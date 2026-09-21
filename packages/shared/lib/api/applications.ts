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
  fullName: string;
  email: string;
  phone: string | null;
  about: string | null;
  status: ApplicationStatus;
  rejectionReason: string | null;
  submittedAt: string;
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
  fullName: string;
  email: string;
  phone: string;
  about?: string;
}): Promise<void> => {
  const { error } = await supabase.from("member_applications").insert({
    tenant_id: params.tenantId,
    full_name: params.fullName.trim(),
    email: params.email.trim().toLowerCase(),
    phone: params.phone.trim() || null,
    about: params.about?.trim() || null,
  });
  if (error) handleSupabaseError(error);

  await supabase.functions.invoke("send-notification", {
    body: {
      type: "application_submitted",
      tenantId: params.tenantId,
      memberName: params.fullName.trim(),
      cooperativeName: params.cooperativeName,
      applicantEmail: params.email.trim().toLowerCase(),
      applicantPhone: params.phone.trim() || undefined,
      applicantAbout: params.about?.trim() || undefined,
    },
  });
};

// ── Admin-facing ─────────────────────────────────────────────────────────────

export const fetchPendingApplications = async (): Promise<MemberApplication[]> => {
  const { data, error } = await supabase
    .from("member_applications")
    .select("*")
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    about: row.about,
    status: row.status,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
  }));
};

export const approveApplication = async (
  tenantId: string,
  application: MemberApplication,
  reviewerId: string
): Promise<{ memberNumber: string; fullName: string; email: string }> => {
  const [firstName, ...rest] = application.fullName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  const member = await addNewMember(tenantId, {
    firstName,
    lastName,
    email: application.email,
    phone: application.phone ?? "",
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
