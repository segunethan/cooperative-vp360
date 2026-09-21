import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMemberProfile } from "./useMemberProfile";

export const useKycGate = () => {
  const navigate = useNavigate();
  const { data: profile } = useMemberProfile();

  const requireKyc = (): boolean => {
    if (profile?.kycVerified) return true;
    toast.error("Complete your membership onboarding first.");
    navigate("/member/kyc");
    return false;
  };

  return { kycVerified: !!profile?.kycVerified, requireKyc };
};
