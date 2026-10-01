import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@jollify/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { Badge } from "@jollify/shared/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { fetchLoanSchedule, fetchEarlyPayoffQuote } from "@jollify/shared/lib/api/loans";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { CalendarClock, AlertTriangle } from "lucide-react";

interface Props {
  loanId: string | null;
  loanNumber: string;
  onClose: () => void;
}

const statusColor: Record<string, string> = {
  PAID: "bg-success/10 text-success border-success/20",
  PARTIAL: "bg-warning/10 text-warning border-warning/20",
  PENDING: "bg-muted/10 text-muted-foreground border-border",
};

const LoanScheduleDialog = ({ loanId, loanNumber, onClose }: Props) => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["loan-schedule", loanId],
    queryFn: () => fetchLoanSchedule(loanId as string),
    enabled: !!loanId,
  });

  const { data: payoffQuote } = useQuery({
    queryKey: ["loan-early-payoff", loanId],
    queryFn: () => fetchEarlyPayoffQuote(loanId as string),
    enabled: !!loanId,
  });

  const nextDue = rows.find((r) => r.status !== "PAID");

  return (
    <Dialog open={!!loanId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Repayment Schedule — {loanNumber}
          </DialogTitle>
        </DialogHeader>

        {!isLoading && nextDue && (
          <div className={`rounded-md border px-4 py-3 text-sm flex items-center justify-between ${nextDue.isOverdue ? "bg-destructive/10 border-destructive/20" : "bg-muted/50"}`}>
            <div>
              <p className="font-medium text-foreground flex items-center gap-1.5">
                {nextDue.isOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                Installment {nextDue.installmentNumber} of {rows.length} due{" "}
                {new Date(nextDue.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {nextDue.isOverdue && <span className="text-destructive font-semibold"> · {nextDue.daysPastDue} days overdue</span>}
              </p>
              <p className="text-muted-foreground">
                {formatMoneyFull(nextDue.installmentAmountKobo - nextDue.paidAmountKobo)} remaining on this installment
                {nextDue.estimatedPenaltyKobo > 0 && (
                  <span className="text-destructive"> · +{formatMoneyFull(nextDue.estimatedPenaltyKobo)} estimated late penalty</span>
                )}
              </p>
            </div>
            <p className="text-lg font-bold text-foreground">{formatMoneyFull(nextDue.installmentAmountKobo)}/mo</p>
          </div>
        )}
        {!isLoading && nextDue && payoffQuote != null && payoffQuote > 0 && (
          <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-2.5 text-sm flex items-center justify-between">
            <p className="text-muted-foreground">Pay off this loan in full today</p>
            <p className="font-bold text-foreground">{formatMoneyFull(payoffQuote)}</p>
          </div>
        )}
        {!isLoading && !nextDue && rows.length > 0 && (
          <div className="rounded-md bg-success/10 border border-success/20 px-4 py-3 text-sm text-success font-medium">
            Fully repaid — every installment has been paid.
          </div>
        )}

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Installment</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No schedule yet — it's generated automatically once the loan is disbursed.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.installmentNumber}>
                    <TableCell className="font-medium">{r.installmentNumber}</TableCell>
                    <TableCell>
                      {new Date(r.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {r.isOverdue && <span className="text-destructive text-xs font-semibold ml-1.5">Overdue</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatMoneyFull(r.principalDueKobo)}</TableCell>
                    <TableCell className="text-right">{formatMoneyFull(r.interestDueKobo)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoneyFull(r.installmentAmountKobo)}</TableCell>
                    <TableCell className="text-right">{formatMoneyFull(r.closingBalanceKobo)}</TableCell>
                    <TableCell className="text-right">{r.paidAmountKobo > 0 ? formatMoneyFull(r.paidAmountKobo) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[r.status]}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoanScheduleDialog;
