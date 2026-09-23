import { Card, CardContent } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Link2, Copy, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const MembershipLinkCard = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const applyLink = tenant ? `${window.location.origin}/apply/${tenant.slug}` : "";
  const verified = tenant?.status === "ACTIVE";

  const copyLink = () => {
    navigator.clipboard.writeText(applyLink);
    toast.success("Membership invitation link copied.");
  };

  if (!verified) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Membership Invitation Link</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Available once your business verification is approved — this keeps unverified cooperatives from publishing a live application link.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/cooperative/kyb")}>
            Complete Business Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Membership Invitation Link</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Share this on your cooperative's website or socials — anyone who clicks it can apply to join, and their application lands in your Applications queue for approval.
        </p>
        <div className="flex items-center gap-2">
          <input readOnly value={applyLink} className="flex-1 h-9 px-3 rounded-md border border-input bg-muted/30 text-xs font-mono" />
          <Button type="button" variant="outline" size="icon" onClick={copyLink} disabled={!applyLink}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MembershipLinkCard;
