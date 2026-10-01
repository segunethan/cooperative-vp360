import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Label } from "@jollify/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { previewLoanTopup, reviewLoanTopup } from "@jollify/shared/lib/api/loans";
import type { LoanPrepaymentStrategy } from "@jollify/shared/lib/api/loanTypes";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { toast } from "sonner";
import { ArrowUpCircle, AlertCircle } from "lucide-react";

interface Props {
  request: { id: string; loanNumber: string; amountKobo: number; defaultStrategy: LoanPrepaymentStrategy } | null;
  reviewerId: string;
  onClose: () => void;
}

const TopupReviewDialog = ({ request, reviewerId, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<LoanPrepaymentStrategy>("REDUCE_TENURE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) setStrategy(request.defaultStrategy);
    setError(null);
  }, [request]);

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ["topup-preview", request?.id, strategy],
    queryFn: () => previewLoanTopup(request!.id, strategy),
    enabled: !!request,
  });

  const approveMutation = useMutation({
    mutationFn: () => reviewLoanTopup(request!.id, true, reviewerId, strategy),
    onSuccess: () => {
      toast.success("Top-up approved — schedule updated.");
      queryClient.invalidateQueries({ queryKey: ["loan-topup-requests"] });
      queryClient.invalidateQueries({ queryKey: ["active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-schedule"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            Review Top-up — {request?.loanNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm">
            <p className="text-muted-foreground">Requested top-up amount</p>
            <p className="text-lg font-bold text-foreground">{request ? formatMoneyFull(request.amountKobo) : "—"}</p>
          </div>

          <div className="space-y-1.5">
            <Label>After approving, how should the balance increase be applied?</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as LoanPrepaymentStrategy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REDUCE_TENURE">Keep monthly amount — extend the term</SelectItem>
                <SelectItem value="REDUCE_INSTALLMENT">Keep the end date — raise the monthly amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
            {loadingPreview ? (
              <p className="text-muted-foreground">Calculating preview…</p>
            ) : preview ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">New monthly amount</p>
                  <p className="font-bold text-foreground text-base">{formatMoneyFull(preview.newInstallmentKobo)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Remaining months</p>
                  <p className="font-bold text-foreground text-base">{preview.newRemainingMonths}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No preview available.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={approveMutation.isPending}>Cancel</Button>
          <Button disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
            {approveMutation.isPending ? "Approving…" : "Approve Top-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TopupReviewDialog;
