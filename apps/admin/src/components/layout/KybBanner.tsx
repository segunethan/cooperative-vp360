import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldAlert, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const COPY: Record<string, { icon: typeof AlertTriangle; text: string; cta: string }> = {
  KYB_SUBMITTED: {
    icon: Clock,
    text: "Your business verification is under review — you'll be able to invite members once it's approved.",
    cta: "View Status",
  },
  KYB_REJECTED: {
    icon: ShieldAlert,
    text: "Your business verification was declined — update your details and resubmit to unlock member invitations.",
    cta: "Resubmit",
  },
};

const DEFAULT_COPY = {
  icon: AlertTriangle,
  text: "Complete your business verification before inviting members — required once, before your first invite.",
  cta: "Get Verified",
};

export const KybBanner = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!tenant || tenant.status === "ACTIVE" || tenant.status === "SUSPENDED") return null;
  if (location.pathname === "/cooperative/kyb") return null;

  const { icon: Icon, text, cta } = COPY[tenant.status] ?? DEFAULT_COPY;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900">
      <Icon className="h-4 w-4 flex-shrink-0" />
      <p className="text-sm flex-1">{text}</p>
      <button
        onClick={() => navigate("/cooperative/kyb")}
        className="text-sm font-semibold underline hover:no-underline flex-shrink-0"
      >
        {cta}
      </button>
    </div>
  );
};
