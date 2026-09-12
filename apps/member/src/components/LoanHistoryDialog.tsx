import { useEffect, useState } from "react";
import { X, History } from "lucide-react";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { fetchLoanLedger, type LoanLedgerRow } from "@jollify/shared/lib/api/loans";

const typeLabel: Record<string, string> = {
  DISBURSEMENT: "Disbursed",
  REPAYMENT: "Repayment",
  TOPUP: "Top-up",
};

interface Props {
  loanId: string;
  loanNumber: string;
  onClose: () => void;
}

const LoanHistoryDialog = ({ loanId, loanNumber, onClose }: Props) => {
  const [rows, setRows] = useState<LoanLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoanLedger(loanId).then(setRows).finally(() => setLoading(false));
  }, [loanId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">History — {loanNumber}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">B/F</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Principal</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Interest</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">No transactions yet.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="px-3 py-2">{typeLabel[r.type]}</td>
                      <td className="px-3 py-2 text-right">{formatMoneyFull(r.balanceBeforeKobo)}</td>
                      <td className="px-3 py-2 text-right">{formatMoneyFull(r.principalPortionKobo)}</td>
                      <td className="px-3 py-2 text-right">{formatMoneyFull(r.interestPortionKobo)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatMoneyFull(r.balanceAfterKobo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanHistoryDialog;
