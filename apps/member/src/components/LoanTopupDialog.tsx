import { useState } from "react";
import { X, ArrowUpCircle } from "lucide-react";
import { nairaToKobo, formatMoneyFull } from "@jollify/shared/lib/money";
import { requestLoanTopup } from "@jollify/shared/lib/api/loans";
import { notifyRequestSubmitted } from "@jollify/shared/lib/api/products";

interface Props {
  loanId: string;
  loanNumber: string;
  tenantId: string;
  memberId: string;
  memberName: string;
  cooperativeName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const LoanTopupDialog = ({ loanId, loanNumber, tenantId, memberId, memberName, cooperativeName, onClose, onSubmitted }: Props) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const naira = parseFloat(amount);
    if (!naira || naira <= 0) { setError("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      await requestLoanTopup({ tenantId, loanId, memberId, amountKobo: nairaToKobo(naira) });
      await notifyRequestSubmitted({
        tenantId, memberName, cooperativeName,
        requestLabel: `${loanNumber} loan top-up`,
        amountLabel: formatMoneyFull(nairaToKobo(naira)),
      });
      onSubmitted();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Request Top-up — {loanNumber}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Additional Amount (₦) *</label>
            <input
              type="number" min={1} placeholder="e.g. 50000"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <p className="text-xs text-muted-foreground">Your cooperative admin will review and approve this request.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit} disabled={submitting}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanTopupDialog;
