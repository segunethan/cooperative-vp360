import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@jollify/shared/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface MemberProfile {
  memberId: string;
  tenantId: string;
  memberNumber: string;
  fullName: string;
  email: string;
  status: string;
  kycVerified: boolean;
  cooperativeName: string;
}

const fetchProfile = async (authUserId: string): Promise<MemberProfile> => {
  const { data: member, error } = await supabase
    .from("members")
    .select("*, tenants(name)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !member) throw new Error("We couldn't load your member record. Please contact your cooperative administrator.");

  return {
    memberId: member.id,
    tenantId: member.tenant_id,
    memberNumber: member.member_number,
    fullName: member.full_name,
    email: member.email ?? "",
    status: member.status,
    kycVerified: member.kyc_verified,
    cooperativeName: (member.tenants as { name: string } | null)?.name ?? "Your Cooperative",
  };
};

export const useMemberProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["member-profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });
};

export const useInvalidateMemberProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => queryClient.invalidateQueries({ queryKey: ["member-profile", user?.id] });
};
