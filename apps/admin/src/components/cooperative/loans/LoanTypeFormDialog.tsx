import { useEffect, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createLoanType,
  updateLoanType,
  type LoanType,
  type LoanTypeStatus,
  type LoanInterestMethod,
  type LoanPrepaymentStrategy,
} from "@jollify/shared/lib/api/loanTypes";
import { toast } from "sonner";
import { Landmark, AlertCircle } from "lucide-react";

const EMPTY_FORM = {
  name: "",
  description: "",
  interestRatePercent: "",
  tenureMonths: "",
  status: "ACTIVE" as LoanTypeStatus,
  interestMethod: "REDUCING_BALANCE" as LoanInterestMethod,
  prepaymentStrategy: "REDUCE_TENURE" as LoanPrepaymentStrategy,
  latePenaltyPercentPerMonth: "",
};

interface Props {
  open: boolean;
  tenantId: string;
  loanType?: LoanType | null;
  onClose: () => void;
}

const LoanTypeFormDialog = ({ open, tenantId, loanType, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (loanType) {
      setForm({
        name: loanType.name,
        description: loanType.description ?? "",
        interestRatePercent: String(loanType.interestRatePercent),
        tenureMonths: String(loanType.tenureMonths),
        status: loanType.status,
        interestMethod: loanType.interestMethod,
        prepaymentStrategy: loanType.prepaymentStrategy,
        latePenaltyPercentPerMonth: loanType.latePenaltyPercentPerMonth != null ? String(loanType.latePenaltyPercentPerMonth) : "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [open, loanType]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        interestRatePercent: parseFloat(form.interestRatePercent),
        tenureMonths: parseInt(form.tenureMonths, 10),
        status: form.status,
        interestMethod: form.interestMethod,
        prepaymentStrategy: form.prepaymentStrategy,
        latePenaltyPercentPerMonth: form.latePenaltyPercentPerMonth ? parseFloat(form.latePenaltyPercentPerMonth) : null,
      };
      if (loanType) return updateLoanType(loanType.id, payload);
      return createLoanType(tenantId, payload);
    },
    onSuccess: () => {
      toast.success(loanType ? "Loan type updated." : "Loan type created.");
      queryClient.invalidateQueries({ queryKey: ["loan-types"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isValid =
    form.name.trim().length > 0 &&
    form.interestRatePercent !== "" && parseFloat(form.interestRatePercent) >= 0 &&
    form.tenureMonths !== "" && parseInt(form.tenureMonths, 10) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            {loanType ? "Edit Loan Type" : "New Loan Type"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              placeholder="e.g. Fixed Term Loan, Emergency Loan"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Shown to members when choosing a loan type — what it's for, eligibility, etc."
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Interest Rate (% p.a.) *</Label>
              <Input
                type="number" min={0} step={0.5} placeholder="e.g. 12"
                value={form.interestRatePercent}
                onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tenure (months) *</Label>
              <Input
                type="number" min={1} placeholder="e.g. 12"
                value={form.tenureMonths}
                onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Interest Method</Label>
              <Select value={form.interestMethod} onValueChange={(v) => setForm({ ...form, interestMethod: v as LoanInterestMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REDUCING_BALANCE">Reducing Balance</SelectItem>
                  <SelectItem value="FLAT">Flat</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Flat charges interest on the full original amount for the whole tenure.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LoanTypeStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active (members can apply)</SelectItem>
                  <SelectItem value="ARCHIVED">Archived (hidden from members)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>When a Member Pays Extra (Prepayment)</Label>
            <Select value={form.prepaymentStrategy} onValueChange={(v) => setForm({ ...form, prepaymentStrategy: v as LoanPrepaymentStrategy })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REDUCE_TENURE">Reduce Tenure — keep the monthly amount, finish earlier</SelectItem>
                <SelectItem value="REDUCE_INSTALLMENT">Reduce Installment — keep the end date, lower the monthly amount</SelectItem>
                <SelectItem value="ADVANCE_PAYMENT">Advance Payment — apply extra to future months as-is</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Late Penalty (% per month overdue, optional)</Label>
            <Input
              type="number" min={0} step={0.5} placeholder="e.g. 1 (leave blank for no penalty)"
              value={form.latePenaltyPercentPerMonth}
              onChange={(e) => setForm({ ...form, latePenaltyPercentPerMonth: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button disabled={!isValid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : loanType ? "Save Changes" : "Create Loan Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoanTypeFormDialog;
