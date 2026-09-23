import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import { Label } from "@jollify/shared/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewKycSubmission, type PendingKycRow } from "@jollify/shared/lib/api/kyc";
import { notifyRequestReviewed } from "@jollify/shared/lib/api/products";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import KycDetails from "./KycDetails";

interface Props {
  submission: PendingKycRow | null;
  onClose: () => void;
}

const KycReviewDialog = ({ submission, onClose }: Props) => {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const mutation = useMutation({
    mutationFn: async (approve: boolean) => {
      await reviewKycSubmission(submission!.id, approve, user?.id ?? "", rejectionReason || undefined);
      if (submission!.memberEmail) {
        await notifyRequestReviewed({
          memberEmail: submission!.memberEmail,
          memberName: submission!.memberName,
          cooperativeName: tenant?.name ?? "your cooperative",
          requestLabel: "Membership onboarding (KYC)",
          status: approve ? "APPROVED" : "REJECTED",
          reason: approve ? undefined : rejectionReason || undefined,
        });
      }
    },
    onSuccess: (_, approve) => {
      toast.success(approve ? "KYC approved." : "KYC rejected — the member has been notified by email.");
      queryClient.invalidateQueries({ queryKey: ["pending-kyc"] });
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClose = () => {
    setRejectionReason("");
    setShowReject(false);
    onClose();
  };

  return (
    <Dialog open={!!submission} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            KYC Submission — {submission?.memberName}
          </DialogTitle>
        </DialogHeader>

        {submission && (
          <div className="space-y-5 py-2">
            <KycDetails submission={submission} showStatus={false} />

            {showReject && (
              <div className="space-y-1.5">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Explain what needs to be corrected…"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!showReject ? (
            <>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setShowReject(true)}>
                Reject
              </Button>
              <Button disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
                {mutation.isPending ? "Approving…" : "Approve"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectionReason || mutation.isPending}
                onClick={() => mutation.mutate(false)}
              >
                {mutation.isPending ? "Rejecting…" : "Confirm Rejection"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KycReviewDialog;
