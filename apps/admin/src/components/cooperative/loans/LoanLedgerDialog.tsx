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
import { fetchLoanLedger } from "@jollify/shared/lib/api/loans";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { History } from "lucide-react";

interface Props {
  loanId: string | null;
  loanNumber: string;
  onClose: () => void;
}

const typeLabel: Record<string, string> = {
  DISBURSEMENT: "Disbursed",
  REPAYMENT: "Repayment",
  TOPUP: "Top-up",
};

const typeColor: Record<string, string> = {
  DISBURSEMENT: "bg-blue-50 text-blue-700 border-blue-200",
  REPAYMENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TOPUP: "bg-amber-50 text-amber-700 border-amber-200",
};

const LoanLedgerDialog = ({ loanId, loanNumber, onClose }: Props) => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["loan-ledger", loanId],
    queryFn: () => fetchLoanLedger(loanId as string),
    enabled: !!loanId,
  });

  return (
    <Dialog open={!!loanId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Transaction History — {loanNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance Before</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions yet.</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColor[r.type]}>{typeLabel[r.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatMoneyFull(r.balanceBeforeKobo)}</TableCell>
                    <TableCell className="text-right">{formatMoneyFull(r.principalPortionKobo)}</TableCell>
                    <TableCell className="text-right">{formatMoneyFull(r.interestPortionKobo)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoneyFull(r.balanceAfterKobo)}</TableCell>
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

export default LoanLedgerDialog;
