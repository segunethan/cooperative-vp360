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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordLoanRepayment } from "@jollify/shared/lib/api/loans";
import { nairaToKobo } from "@jollify/shared/lib/money";
import { toast } from "sonner";
import { Banknote, AlertCircle } from "lucide-react";

interface Props {
  loanId: string | null;
  loanNumber: string;
  onClose: () => void;
}

const RecordRepaymentDialog = ({ loanId, loanNumber, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("bank_transfer");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => recordLoanRepayment(loanId as string, nairaToKobo(parseFloat(amount)), channel, paidAt),
    onSuccess: () => {
      toast.success("Repayment recorded.");
      queryClient.invalidateQueries({ queryKey: ["loan-ledger", loanId] });
      queryClient.invalidateQueries({ queryKey: ["active-loans"] });
      handleClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleClose = () => {
    setAmount("");
    setChannel("bank_transfer");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={!!loanId} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Record Repayment — {loanNumber}
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
            <Label>Amount Paid (₦) *</Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Interest due is calculated automatically from the outstanding balance; the rest reduces principal.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Date Paid</Label>
            <Input type="date" max={new Date().toISOString().split("T")[0]} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Recording…" : "Record Repayment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordRepaymentDialog;
