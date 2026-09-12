import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, ArrowUpCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@jollify/shared/lib/supabase";
import { formatMoneyFull, nairaToKobo } from "@jollify/shared/lib/money";
import { fetchLoanLedger, requestLoanTopup, type LoanLedgerRow } from "@jollify/shared/lib/api/loans";
import { notifyRequestSubmitted } from "@jollify/shared/lib/api/products";
import { useMemberProfile } from "@/hooks/useMemberProfile";

const typeLabel: Record<string, string> = { DISBURSEMENT: "Disbursed", REPAYMENT: "Repayment", TOPUP: "Top-up" };

const fetchLoanSummary = async (loanId: string) => {
  const { data } = await supabase.from("loans").select("loan_number, principal_kobo, status, purpose").eq("id", loanId).single();
  return data;
};

const LoanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMemberProfile();

  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: loan, isLoading: loadingLoan } = useQuery({
    queryKey: ["loan-summary", id],
    queryFn: () => fetchLoanSummary(id!),
    enabled: !!id,
  });

  const { data: ledger = [], isLoading: loadingLedger } = useQuery<LoanLedgerRow[]>({
    queryKey: ["loan-ledger", id],
    queryFn: () => fetchLoanLedger(id!),
    enabled: !!id,
  });

  const handleTopup = async () => {
    if (!profile || !id) return;
    setError(null);
    const naira = parseFloat(amount);
    if (!naira || naira <= 0) { setError("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      await requestLoanTopup({ tenantId: profile.tenantId, loanId: id, memberId: profile.memberId, amountKobo: nairaToKobo(naira) });
      await notifyRequestSubmitted({
        tenantId: profile.tenantId, memberName: profile.fullName, cooperativeName: profile.cooperativeName,
        requestLabel: `${loan?.loan_number} loan top-up`, amountLabel: formatMoneyFull(nairaToKobo(naira)),
      });
      queryClient.invalidateQueries({ queryKey: ["loan-ledger", id] });
      setTopupOpen(false);
      setAmount("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLoan || !loan) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/member/loans")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Loans
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{loan.loan_number}</h1>
          <p className="text-sm text-muted-foreground">{formatMoneyFull(loan.principal_kobo)} · {loan.purpose ?? "—"}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Transaction History</p>
        <div className="border rounded-lg overflow-x-auto bg-white">
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
              {loadingLedger ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Loading…</td></tr>
              ) : ledger.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">No transactions yet.</td></tr>
              ) : (
                ledger.map((r) => (
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

      {loan.status === "ACTIVE" && (
        topupOpen ? (
          <div className="space-y-3 bg-white rounded-xl border border-border p-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}
            <p className="text-sm font-medium text-foreground">Request a top-up</p>
            <input type="number" min={1} placeholder="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <div className="flex gap-2">
              <button onClick={() => { setTopupOpen(false); setAmount(""); setError(null); }} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={handleTopup} disabled={submitting} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setTopupOpen(true)} className="w-full h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5" /> Request Top-up
          </button>
        )
      )}
    </div>
  );
};

export default LoanDetail;
