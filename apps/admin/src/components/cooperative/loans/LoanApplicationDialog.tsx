import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchActiveMembers } from "@jollify/shared/lib/api/members";
import { submitLoanApplication } from "@jollify/shared/lib/api/loans";
import { fetchActiveLoanTypes } from "@jollify/shared/lib/api/loanTypes";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Landmark, AlertCircle } from "lucide-react";

const EMPTY_FORM = {
  memberNumber: "",
  loanTypeId: "",
  principalNaira: "",
  purpose: "",
  notes: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const LoanApplicationDialog = ({ open, onClose, onSubmitted }: Props) => {
  const { tenant } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["active-members-list"],
    queryFn: fetchActiveMembers,
    enabled: open,
  });

  const { data: loanTypes = [], isLoading: loadingLoanTypes } = useQuery({
    queryKey: ["active-loan-types"],
    queryFn: fetchActiveLoanTypes,
    enabled: open,
  });

  const selectedLoanType = loanTypes.find((t) => t.id === form.loanTypeId) ?? null;

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selectedLoanType) throw new Error("Select a loan type");
      return submitLoanApplication({
        tenantId: tenant?.id ?? "",
        memberNumber: form.memberNumber,
        loanTypeId: selectedLoanType.id,
        principalNaira: parseFloat(form.principalNaira),
        interestRatePercent: selectedLoanType.interestRatePercent,
        tenureMonths: selectedLoanType.tenureMonths,
        purpose: form.purpose || undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Loan application submitted successfully.");
      setForm(EMPTY_FORM);
      setError(null);
      onSubmitted();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isValid =
    form.memberNumber &&
    !!selectedLoanType &&
    form.principalNaira &&
    parseFloat(form.principalNaira) > 0;

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            New Loan Application
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Member */}
          <div className="space-y-1.5">
            <Label>Member *</Label>
            <Select
              value={form.memberNumber}
              onValueChange={(v) => setForm({ ...form, memberNumber: v })}
              disabled={loadingMembers}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingMembers ? "Loading members…" : "Select active member"} />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.memberNumber} value={m.memberNumber}>
                    {m.name}
                    <span className="ml-2 text-xs text-muted-foreground">{m.memberNumber}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loan Type */}
          <div className="space-y-1.5">
            <Label>Loan Type *</Label>
            <Select
              value={form.loanTypeId}
              onValueChange={(v) => setForm({ ...form, loanTypeId: v })}
              disabled={loadingLoanTypes}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingLoanTypes ? "Loading loan types…" : "Select a configured loan type"} />
              </SelectTrigger>
              <SelectContent>
                {loanTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {t.interestRatePercent}% p.a., {t.tenureMonths} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingLoanTypes && loanTypes.length === 0 && (
              <p className="text-xs text-destructive">No loan types configured yet — add one under the "Loan Types" tab first.</p>
            )}
          </div>

          {/* Principal + Rate/Tenure (locked to the selected loan type) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Principal Amount (₦) *</Label>
              <Input
                type="number"
                min={1000}
                placeholder="e.g. 500000"
                value={form.principalNaira}
                onChange={(e) => setForm({ ...form, principalNaira: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest Rate / Tenure</Label>
              <Input
                readOnly
                value={selectedLoanType ? `${selectedLoanType.interestRatePercent}% · ${selectedLoanType.tenureMonths}mo` : "—"}
                className="bg-muted/50"
              />
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <Select
              value={form.purpose}
              onValueChange={(v) => setForm({ ...form, purpose: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purpose (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Business Expansion">Business Expansion</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Medical / Emergency">Medical / Emergency</SelectItem>
                <SelectItem value="Home Improvement">Home Improvement</SelectItem>
                <SelectItem value="Agriculture">Agriculture</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes for the loan officer…"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Live preview of monthly repayment */}
          {isValid && (
            <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-foreground">Indicative repayment</p>
              {(() => {
                const P = parseFloat(form.principalNaira);
                const r = (selectedLoanType?.interestRatePercent ?? 0) / 100 / 12;
                const n = selectedLoanType?.tenureMonths ?? 0;
                const monthly = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                const total = monthly * n;
                return (
                  <>
                    <p className="text-muted-foreground">
                      Monthly: <span className="font-semibold text-foreground">₦{monthly.toLocaleString("en-NG", { maximumFractionDigits: 0 })}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Total repayable: <span className="font-semibold text-foreground">₦{total.toLocaleString("en-NG", { maximumFractionDigits: 0 })}</span>
                    </p>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!isValid || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoanApplicationDialog;
