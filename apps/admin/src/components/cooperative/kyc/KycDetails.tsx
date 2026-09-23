import { Badge } from "@jollify/shared/components/ui/badge";
import type { KycSubmission } from "@jollify/shared/lib/api/kyc";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { FileText, ExternalLink } from "lucide-react";

const idTypeLabel: Record<string, string> = {
  NIN: "National ID (NIN)",
  PASSPORT: "International Passport",
  DRIVERS_LICENSE: "Driver's License",
  VOTERS_CARD: "Voter's Card",
};

const statusColor: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/20",
  APPROVED: "bg-success/10 text-success border-success/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

interface Props {
  submission: KycSubmission;
  showStatus?: boolean;
}

const KycDetails = ({ submission, showStatus = true }: Props) => (
  <div className="space-y-5">
    {showStatus && (
      <div className="flex flex-wrap items-center gap-3 pb-1">
        <Badge variant="outline" className={statusColor[submission.status] ?? ""}>
          {submission.status === "PENDING" ? "Under Review" : submission.status === "APPROVED" ? "Approved" : "Rejected"}
        </Badge>
        <span className="text-xs text-muted-foreground">Submitted {fmtDate(submission.submittedAt)}</span>
        {submission.reviewedAt && (
          <span className="text-xs text-muted-foreground">
            · {submission.status === "APPROVED" ? "Approved" : "Reviewed"} {fmtDate(submission.reviewedAt)}
          </span>
        )}
      </div>
    )}

    {submission.status === "REJECTED" && submission.rejectionReason && (
      <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
        <span className="font-semibold">Rejection reason: </span>{submission.rejectionReason}
      </div>
    )}

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
        <Field label="NIN" value={submission.nin} />
        <Field label="ID Type" value={idTypeLabel[submission.idType] ?? submission.idType} />
        <Field label="ID Number" value={submission.idNumber} />
        <Field label="Expiry Date" value={fmtDate(submission.idExpiryDate)} />
        <Field label="Secret Question" value={submission.secretQuestion} />
      </div>
      {submission.idDocumentUrl && (
        <a href={submission.idDocumentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline">
          <FileText className="h-3.5 w-3.5" /> View uploaded ID document <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>

    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Declarations</p>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Not a member of another society with identical objectives" value={submission.notInOtherSociety ? "Confirmed" : "Not confirmed"} />
        <Field label="Existing debt declaration" value={submission.existingDebtDeclaration || "None declared"} />
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

    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Entrance Fee & Thrift</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entrance Fee" value={submission.entranceFeeKobo ? formatMoneyFull(submission.entranceFeeKobo) : "Not required"} />
        <Field label="Fee Paid Date" value={fmtDate(submission.entranceFeePaidDate)} />
        <Field label="Monthly Thrift Commitment" value={submission.monthlyThriftKobo ? formatMoneyFull(submission.monthlyThriftKobo) : "—"} />
        <Field label="Signature" value={submission.signatureName} />
      </div>
      {submission.entranceFeeReceiptUrl && (
        <a href={submission.entranceFeeReceiptUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline">
          <FileText className="h-3.5 w-3.5" /> View entrance fee receipt <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  </div>
);

export default KycDetails;
