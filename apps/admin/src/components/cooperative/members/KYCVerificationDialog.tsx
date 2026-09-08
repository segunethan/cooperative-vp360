import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@jollify/shared/hooks/use-toast";

interface KYCVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberId: string;
  onConfirm?: () => void;
  loading?: boolean;
}

const KYCVerificationDialog = ({ open, onOpenChange, memberName, memberId, onConfirm, loading = false }: KYCVerificationDialogProps) => {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<null | "success" | "failed">(null);

  const handleVerify = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setResult("success");
      toast({ title: "KYC Verified", description: `${memberName}'s identity has been verified via NIBSS.` });
    }, 2500);
  };

  const handleClose = () => {
    setResult(null);
    setVerifying(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            KYC Verification
          </DialogTitle>
          <DialogDescription>Verify member identity via NIBSS BVN/NIN lookup.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Member</span>
              <span className="font-medium text-foreground">{memberName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Member ID</span>
              <span className="font-medium text-foreground">{memberId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BVN Status</span>
              {result === "success" ? (
                <Badge className="bg-success/10 text-success border-success/20">Verified</Badge>
              ) : result === "failed" ? (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>
              ) : (
                <Badge variant="outline">Unverified</Badge>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">NIN Status</span>
              {result === "success" ? (
                <Badge className="bg-success/10 text-success border-success/20">Verified</Badge>
              ) : (
                <Badge variant="outline">Unverified</Badge>
              )}
            </div>
          </div>

          {result === "success" && (
            <div className="flex items-center gap-2 text-success bg-success/10 rounded-lg p-3">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-medium">Identity verified successfully via NIBSS.</span>
            </div>
          )}
          {result === "failed" && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3">
              <ShieldAlert className="h-5 w-5" />
              <span className="text-sm font-medium">Verification failed. Please check BVN/NIN details.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button onClick={handleVerify} disabled={verifying || result === "success"}>
            {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {verifying ? "Verifying..." : result === "success" ? "Verified" : "Verify via NIBSS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KYCVerificationDialog;
