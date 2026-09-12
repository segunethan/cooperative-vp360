import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Plus, X, ChevronRight } from "lucide-react";
import { supabase } from "@jollify/shared/lib/supabase";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { submitLoanApplication } from "@jollify/shared/lib/api/loans";
import { notifyRequestSubmitted } from "@jollify/shared/lib/api/products";
import { useMemberProfile } from "@/hooks/useMemberProfile";

const LOAN_PRODUCTS = [
  { label: "Personal Loan — 12% p.a., up to 24 months", rate: 12, maxMonths: 24 },
  { label: "Emergency Loan — 8% p.a., up to 12 months", rate: 8, maxMonths: 12 },
  { label: "Business Loan — 15% p.a., up to 36 months", rate: 15, maxMonths: 36 },
];

const LOAN_PURPOSES = ["Business Expansion", "Education", "Medical / Emergency", "Home Improvement", "Agriculture", "Other"];

const EMPTY_LOAN = { productIndex: "", principalNaira: "", tenure: "", purpose: "", notes: "" };

interface LoanRow {
  id: string;
  loanNumber: string;
  principal: number;
  status: string;
  date: string;
  purpose: string;
}

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
  REPAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

const LoansList = () => {
  const { data: profile } = useMemberProfile();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [loanOpen, setLoanOpen] = useState(false);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanLoading, setLoanLoading] = useState(false);

  const loadLoans = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("loans")
      .select("id, loan_number, principal_kobo, status, purpose, created_at")
      .eq("member_id", profile.memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLoans(
      (data ?? []).map((l) => ({
        id: l.id,
        loanNumber: l.loan_number,
        principal: l.principal_kobo,
        status: l.status,
        date: new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        purpose: l.purpose ?? "—",
      }))
    );
    setLoading(false);
  };

  useEffect(() => { loadLoans(); }, [profile?.memberId]);

  const selectedProduct = loanForm.productIndex !== "" ? LOAN_PRODUCTS[parseInt(loanForm.productIndex, 10)] : null;
  const tenure = loanForm.tenure ? parseInt(loanForm.tenure, 10) : selectedProduct?.maxMonths ?? 0;
  const principal = parseFloat(loanForm.principalNaira) || 0;
  const showRepayment = selectedProduct && principal > 0 && tenure > 0;
  const r = selectedProduct ? selectedProduct.rate / 100 / 12 : 0;
  const monthly = showRepayment ? (r === 0 ? principal / tenure : (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1)) : 0;

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError(null);
    if (!profile) return;
    const idx = parseInt(loanForm.productIndex, 10);
    const product = isNaN(idx) ? null : LOAN_PRODUCTS[idx];
    if (!loanForm.principalNaira || parseFloat(loanForm.principalNaira) <= 0) { setLoanError("Enter a valid loan amount"); return; }
    if (!product) { setLoanError("Select a loan product"); return; }
    const t = loanForm.tenure ? parseInt(loanForm.tenure, 10) : product.maxMonths;
    if (t > product.maxMonths) { setLoanError(`Max tenure for this product is ${product.maxMonths} months`); return; }
    setLoanLoading(true);
    try {
      await submitLoanApplication({
        tenantId: profile.tenantId, memberNumber: profile.memberNumber,
        principalNaira: parseFloat(loanForm.principalNaira), interestRatePercent: product.rate, tenureMonths: t,
        purpose: loanForm.purpose || undefined, notes: loanForm.notes || undefined,
      });
      await notifyRequestSubmitted({
        tenantId: profile.tenantId, memberName: profile.fullName, cooperativeName: profile.cooperativeName,
        requestLabel: "Loan application", amountLabel: formatMoneyFull(parseFloat(loanForm.principalNaira) * 100),
      });
      setLoanOpen(false);
      setLoanForm(EMPTY_LOAN);
      await loadLoans();
    } catch (err) {
      setLoanError((err as Error).message);
    } finally {
      setLoanLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Loans</h1>
          <p className="text-sm text-muted-foreground">Applications, active loans, and repayment history.</p>
        </div>
        <button
          onClick={() => setLoanOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/8 hover:bg-primary/12 flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Apply
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : loans.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No loans on record.</div>
      ) : (
        <div className="space-y-2">
          {loans.map((l) => (
            <Link
              key={l.id}
              to={`/member/loans/${l.id}`}
              className="flex items-center justify-between bg-white rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{formatMoneyFull(l.principal)}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.loanNumber} · {l.purpose} · {l.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle[l.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {l.status === "PENDING" ? "Pending" : l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {loanOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLoanOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Apply for a Loan</h3>
              </div>
              <button onClick={() => { setLoanOpen(false); setLoanForm(EMPTY_LOAN); setLoanError(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLoan} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Fill in the details below. Your cooperative admin will review and approve your application.</p>
              {loanError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{loanError}</div>}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Loan Product *</label>
                <select
                  value={loanForm.productIndex}
                  onChange={(e) => {
                    const idx = e.target.value;
                    const p = LOAN_PRODUCTS[parseInt(idx, 10)];
                    setLoanForm({ ...loanForm, productIndex: idx, tenure: p ? String(p.maxMonths) : "" });
                  }}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select a product</option>
                  {LOAN_PRODUCTS.map((p, i) => <option key={i} value={String(i)}>{p.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Amount (₦) *</label>
                  <input type="number" min="1000" placeholder="e.g. 200000" value={loanForm.principalNaira} onChange={(e) => setLoanForm({ ...loanForm, principalNaira: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tenure (months)</label>
                  <input type="number" min="1" max={selectedProduct?.maxMonths ?? 60} placeholder={selectedProduct ? String(selectedProduct.maxMonths) : "e.g. 12"} value={loanForm.tenure} onChange={(e) => setLoanForm({ ...loanForm, tenure: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Purpose</label>
                <select value={loanForm.purpose} onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm">
                  <option value="">Select purpose (optional)</option>
                  {LOAN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <input type="text" placeholder="Additional context for your loan officer…" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm" />
              </div>

              {showRepayment && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm space-y-1">
                  <p className="font-semibold text-emerald-800">Estimated repayment</p>
                  <p className="text-emerald-700">Monthly: <span className="font-bold">₦{monthly.toLocaleString("en-NG", { maximumFractionDigits: 0 })}</span></p>
                  <p className="text-emerald-700">Total repayable: <span className="font-bold">₦{(monthly * tenure).toLocaleString("en-NG", { maximumFractionDigits: 0 })}</span></p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setLoanOpen(false); setLoanForm(EMPTY_LOAN); setLoanError(null); }} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
                <button type="submit" disabled={loanLoading || !loanForm.productIndex || !loanForm.principalNaira} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loanLoading ? (<><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>) : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoansList;
