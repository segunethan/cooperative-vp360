import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export interface CooperativeProfile {
  id: string;
  cooperativeNumber: string | null;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  rcNumber: string | null;
  logoUrl: string | null;
  status: string;
  billingPlan: string;
  trialEndsAt: string | null;
}

export interface UpdateCooperativeProfileData {
  name: string;
  email: string;
  phone: string;
  address: string;
  rcNumber: string;
}

export interface TenantUserRow {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchCooperativeProfile = async (tenantId: string): Promise<CooperativeProfile> => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (error) handleSupabaseError(error);

  return {
    id: data!.id,
    cooperativeNumber: data!.cooperative_number ?? null,
    name: data!.name,
    slug: data!.slug,
    email: data!.email,
    phone: data!.phone ?? null,
    address: data!.address ?? null,
    rcNumber: data!.rc_number ?? null,
    logoUrl: data!.logo_url ?? null,
    status: data!.status,
    billingPlan: data!.billing_plan,
    trialEndsAt: data!.trial_ends_at ?? null,
  };
};

export const fetchTenantUsers = async (tenantId: string): Promise<TenantUserRow[]> => {
  const { data, error } = await supabase
    .from("tenant_users")
    .select("id, user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) handleSupabaseError(error);

  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    role: r.role,
    joinedAt: new Date(r.created_at).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    }),
  }));
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const updateCooperativeProfile = async (
  tenantId: string,
  data: UpdateCooperativeProfileData
): Promise<void> => {
  const { error } = await supabase
    .from("tenants")
    .update({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim() || null,
      address: data.address.trim() || null,
      rc_number: data.rcNumber.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  if (error) handleSupabaseError(error);
};

export const updateTenantUserRole = async (
  tenantUserId: string,
  role: string
): Promise<void> => {
  const { error } = await supabase
    .from("tenant_users")
    .update({ role })
    .eq("id", tenantUserId);
  if (error) handleSupabaseError(error);
};
