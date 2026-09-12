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
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

const idTypeLabel: Record<string, string> = {
  NIN: "National ID (NIN)",
  PASSPORT: "International Passport",
  DRIVERS_LICENSE: "Driver's License",
  VOTERS_CARD: "Voter's Card",
};

interface Props {
  submission: PendingKycRow | null;
  onClose: () => void;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

const KycReviewDialog = ({ submission, onClose }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const mutation = useMutation({
    mutationFn: (approve: boolean) =>
      reviewKycSubmission(submission!.id, approve, user?.id ?? "", rejectionReason || undefined),
    onSuccess: (_, approve) => {
      toast.success(approve ? "KYC approved." : "KYC rejected.");
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
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bank Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank Name" value={submission.bankName} />
                <Field label="Account Number" value={submission.accountNumber} />
                <Field label="Account Name" value={submission.accountName} />
                <Field label="BVN" value={submission.bvn} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identity Document</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ID Type" value={idTypeLabel[submission.idType] ?? submission.idType} />
                <Field label="ID Number" value={submission.idNumber} />
                <Field label="Expiry Date" value={new Date(submission.idExpiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
                <Field label="Secret Question" value={submission.secretQuestion} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Next of Kin</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name" value={submission.nextOfKinName} />
                <Field label="Relationship" value={submission.nextOfKinRelationship} />
                <Field label="Phone" value={submission.nextOfKinPhone} />
                <Field label="Address" value={submission.nextOfKinAddress} />
              </div>
            </div>

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
