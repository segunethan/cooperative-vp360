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
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Landmark, AlertCircle } from "lucide-react";

// Preset loan product configurations
const LOAN_PRODUCTS = [
  { label: "Personal Loan — 12% / 24mo max", rate: 12, maxMonths: 24 },
  { label: "Emergency Loan — 8% / 12mo max", rate: 8, maxMonths: 12 },
  { label: "Business Loan — 15% / 36mo max", rate: 15, maxMonths: 36 },
  { label: "Custom", rate: null, maxMonths: null },
];

const EMPTY_FORM = {
  memberNumber: "",
  productIndex: "",
  principalNaira: "",
  interestRatePercent: "",
  tenureMonths: "",
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

  const submitMutation = useMutation({
    mutationFn: () =>
      submitLoanApplication({
        tenantId: tenant?.id ?? "",
        memberNumber: form.memberNumber,
        principalNaira: parseFloat(form.principalNaira),
        interestRatePercent: parseFloat(form.interestRatePercent),
        tenureMonths: parseInt(form.tenureMonths, 10),
        purpose: form.purpose || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Loan application submitted successfully.");
      setForm(EMPTY_FORM);
      setError(null);
      onSubmitted();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleProductSelect = (indexStr: string) => {
    const idx = parseInt(indexStr, 10);
    const product = LOAN_PRODUCTS[idx];
    setForm((f) => ({
      ...f,
      productIndex: indexStr,
      interestRatePercent: product.rate !== null ? String(product.rate) : "",
      tenureMonths: product.maxMonths !== null ? String(product.maxMonths) : "",
    }));
  };

  const isCustom = form.productIndex === "3" || form.productIndex === "";

  const isValid =
    form.memberNumber &&
    form.principalNaira &&
    parseFloat(form.principalNaira) > 0 &&
    form.interestRatePercent &&
    form.tenureMonths &&
    parseInt(form.tenureMonths, 10) > 0;

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

          {/* Loan Product */}
          <div className="space-y-1.5">
            <Label>Loan Product</Label>
            <Select value={form.productIndex} onValueChange={handleProductSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a product (pre-fills rate & tenure)" />
              </SelectTrigger>
              <SelectContent>
                {LOAN_PRODUCTS.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Principal + Rate side-by-side */}
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
              <Label>Interest Rate (% p.a.) *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="e.g. 12"
                value={form.interestRatePercent}
                disabled={!isCustom}
                onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
              />
            </div>
          </div>

          {/* Tenure */}
          <div className="space-y-1.5">
            <Label>Tenure (months) *</Label>
            <Input
              type="number"
              min={1}
              max={60}
              placeholder="e.g. 12"
              value={form.tenureMonths}
              disabled={!isCustom}
              onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })}
            />
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
                const r = parseFloat(form.interestRatePercent) / 100 / 12;
                const n = parseInt(form.tenureMonths, 10);
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
