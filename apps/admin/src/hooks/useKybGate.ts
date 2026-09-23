import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export const useKybGate = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();

  const requireKyb = (): boolean => {
    if (tenant?.status === "ACTIVE") return true;
    toast.error("Complete your business verification before inviting members.");
    navigate("/cooperative/kyb");
    return false;
  };

  return { kybVerified: tenant?.status === "ACTIVE", requireKyb };
};
