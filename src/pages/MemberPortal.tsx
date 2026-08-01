import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, PiggyBank, CreditCard, BadgeCheck, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatMoneyFull, nairaToKobo, generatePaymentReference } from "@/lib/money";
import { submitLoanApplication } from "@/lib/api/loans";

interface MemberData {
  memberId: string;
  tenantId: string;
  memberNumber: string;
  fullName: string;
  email: string;
  status: string;
  kycVerified: boolean;
  cooperativeName: string;
  contributionTotal: number;
  loanTotal: number;
  contributions: { date: string; amount: number; status: string; reference: string }[];
  loans: { loanNumber: string; principal: number; status: string; date: string; purpose: string }[];
}

const LOAN_PRODUCTS = [
  { label: "Personal Loan — 12% p.a., up to 24 months", rate: 12, maxMonths: 24 },
  { label: "Emergency Loan — 8% p.a., up to 12 months", rate: 8, maxMonths: 12 },
  { label: "Business Loan — 15% p.a., up to 36 months", rate: 15, maxMonths: 36 },
];

const LOAN_PURPOSES = [
  "Business Expansion", "Education", "Medical / Emergency",
  "Home Improvement", "Agriculture", "Other",
];

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INVITED: "bg-amber-50 text-amber-700 border-amber-200",
  SUSPENDED: "bg-red-50 text-red-700 border-red-200",
  EXITED: "bg-gray-50 text-gray-600 border-gray-200",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  INVITED: "Pending Approval",
  SUSPENDED: "Suspended",
  EXITED: "Exited",
};

const EMPTY_CONTRIB = { amount: "", channel: "", paidDate: "", receiptNote: "", notes: "" };
const EMPTY_LOAN = { productIndex: "", principalNaira: "", tenure: "", purpose: "", notes: "" };

const MemberPortal = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contribution dialog
  const [contribOpen, setContribOpen] = useState(false);
  const [contribForm, setContribForm] = useState(EMPTY_CONTRIB);
  const [contribError, setContribError] = useState<string | null>(null);
  const [contribLoading, setContribLoading] = useState(false);

  // Loan dialog
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanLoading, setLoanLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const uid = session.user.id;

      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("*, tenants(name)")
        .eq("auth_user_id", uid)
        .maybeSingle();

      if (memberError || !member) {
        setError("Member account not found. Contact your cooperative administrator.");
        setLoading(false);
        return;
      }

      const { data: contribs } = await supabase
        .from("contributions")
        .select("amount_kobo, status, reference, created_at")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: loans } = await supabase
        .from("loans")
        .select("loan_number, principal_kobo, status, purpose, created_at")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const contributionTotal = (contribs ?? [])
        .filter((c) => c.status === "COMPLETED")
        .reduce((s, c) => s + c.amount_kobo, 0);

      const loanTotal = (loans ?? [])
        .filter((l) => l.status === "ACTIVE")
        .reduce((s, l) => s + l.principal_kobo, 0);

      setData({
        memberId: member.id,
        tenantId: member.tenant_id,
        memberNumber: member.member_number,
        fullName: member.full_name,
        email: member.email ?? "",
        status: member.status,
        kycVerified: member.kyc_verified,
        cooperativeName: (member.tenants as { name: string } | null)?.name ?? "Your Cooperative",
        contributionTotal,
        loanTotal,
        contributions: (contribs ?? []).map((c) => ({
          date: new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          amount: c.amount_kobo,
          status: c.status,
          reference: c.reference,
        })),
        loans: (loans ?? []).map((l) => ({
          loanNumber: l.loan_number,
          principal: l.principal_kobo,
          status: l.status,
          date: new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          purpose: l.purpose ?? "—",
        })),
      });
      setLoading(false);
    };

    load();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const refreshData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !data) return;
    const uid = session.user.id;

    const [{ data: contribs }, { data: loans }] = await Promise.all([
      supabase.from("contributions").select("amount_kobo, status, reference, created_at").eq("member_id", data.memberId).order("created_at", { ascending: false }).limit(10),
      supabase.from("loans").select("loan_number, principal_kobo, status, purpose, created_at").eq("member_id", data.memberId).order("created_at", { ascending: false }).limit(5),
    ]);

    const contributionTotal = (contribs ?? []).filter((c) => c.status === "COMPLETED").reduce((s, c) => s + c.amount_kobo, 0);
    const loanTotal = (loans ?? []).filter((l) => l.status === "ACTIVE").reduce((s, l) => s + l.principal_kobo, 0);

    setData((prev) => prev ? {
      ...prev,
      contributionTotal,
      loanTotal,
      contributions: (contribs ?? []).map((c) => ({
        date: new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        amount: c.amount_kobo,
        status: c.status,
        reference: c.reference,
      })),
      loans: (loans ?? []).map((l) => ({
        loanNumber: l.loan_number,
        principal: l.principal_kobo,
        status: l.status,
        date: new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        purpose: l.purpose ?? "—",
      })),
    } : prev);
  };

  const handleSubmitContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    setContribError(null);
    if (!data) return;
    if (!contribForm.amount || parseFloat(contribForm.amount) <= 0) { setContribError("Enter a valid amount"); return; }
    if (!contribForm.channel) { setContribError("Select a payment channel"); return; }
    setContribLoading(true);

    const parts = [
      contribForm.paidDate ? `Payment date: ${contribForm.paidDate}` : null,
      contribForm.receiptNote ? `Receipt ref: ${contribForm.receiptNote}` : null,
      contribForm.notes || null,
    ].filter(Boolean);

    const { error } = await supabase.from("contributions").insert({
      tenant_id: data.tenantId,
      member_id: data.memberId,
      amount_kobo: nairaToKobo(parseFloat(contribForm.amount)),
      channel: contribForm.channel,
      status: "PENDING",
      reference: generatePaymentReference("CONTRIB"),
      notes: parts.length ? parts.join(" | ") : null,
    });

    setContribLoading(false);
    if (error) { setContribError(error.message); return; }
    setContribOpen(false);
    setContribForm(EMPTY_CONTRIB);
    await refreshData();
  };

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError(null);
    if (!data) return;
    const idx = parseInt(loanForm.productIndex, 10);
    const product = isNaN(idx) ? null : LOAN_PRODUCTS[idx];
    if (!loanForm.principalNaira || parseFloat(loanForm.principalNaira) <= 0) { setLoanError("Enter a valid loan amount"); return; }
    if (!product) { setLoanError("Select a loan product"); return; }
    const tenure = loanForm.tenure ? parseInt(loanForm.tenure, 10) : product.maxMonths;
    if (tenure > product.maxMonths) { setLoanError(`Max tenure for this product is ${product.maxMonths} months`); return; }
    setLoanLoading(true);

    try {
      await submitLoanApplication({
        tenantId: data.tenantId,
        memberNumber: data.memberNumber,
        principalNaira: parseFloat(loanForm.principalNaira),
        interestRatePercent: product.rate,
        tenureMonths: tenure,
        purpose: loanForm.purpose || undefined,
        notes: loanForm.notes || undefined,
      });
      setLoanOpen(false);
      setLoanForm(EMPTY_LOAN);
      await refreshData();
    } catch (err) {
      setLoanError((err as Error).message);
    } finally {
      setLoanLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your account…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-muted-foreground text-sm">{error}</p>
          <button onClick={handleSignOut} className="text-primary text-sm font-medium hover:underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const selectedProduct = loanForm.productIndex !== "" ? LOAN_PRODUCTS[parseInt(loanForm.productIndex, 10)] : null;
  const tenure = loanForm.tenure ? parseInt(loanForm.tenure, 10) : selectedProduct?.maxMonths ?? 0;
  const principal = parseFloat(loanForm.principalNaira) || 0;
  const showRepayment = selectedProduct && principal > 0 && tenure > 0;
  const r = selectedProduct ? selectedProduct.rate / 100 / 12 : 0;
  const monthly = showRepayment ? (r === 0 ? principal / tenure : (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1)) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">J</span>
            </div>
            <span className="font-bold text-sm tracking-tight">Jollify</span>
            <span className="text-border mx-1">·</span>
            <span className="text-sm text-muted-foreground truncate max-w-[160px]">{data.cooperativeName}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Member ID card */}
        <div className="bg-[#012d1d] rounded-2xl p-6 text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #c1ecd4 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Member Account</p>
            <h1 className="text-2xl font-bold tracking-tight mb-1">{data.fullName}</h1>
            <p className="text-white/50 text-sm mb-5">{data.email}</p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wider mb-0.5">Member ID</p>
                <p className="text-white font-mono font-bold text-lg tracking-wider">{data.memberNumber}</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wider mb-0.5">Status</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[data.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {statusLabel[data.status] ?? data.status}
                </span>
              </div>
              {data.kycVerified && (
                <>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                    <BadgeCheck className="h-4 w-4" />
                    KYC Verified
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Total Contributions</p>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{formatMoneyFull(data.contributionTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed payments</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Active Loans</p>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{formatMoneyFull(data.loanTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Outstanding balance</p>
          </div>
        </div>

        {/* Contributions */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">My Contributions</h2>
            </div>
            <button
              onClick={() => setContribOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/8 hover:bg-primary/12"
            >
              <Plus className="h-3.5 w-3.5" />
              Submit Payment
            </button>
          </div>
          {data.contributions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No contributions recorded yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {data.contributions.map((c) => (
                <div key={c.reference} className="px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === "COMPLETED" ? "bg-emerald-500" : c.status === "PENDING" ? "bg-amber-400" : "bg-red-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatMoneyFull(c.amount)}</p>
                      <p className="text-xs text-muted-foreground">{c.date}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : c.status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                    {c.status === "COMPLETED" ? "Completed" : c.status === "PENDING" ? "Pending Review" : "Failed"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loans */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">My Loans</h2>
            </div>
            <button
              onClick={() => setLoanOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/8 hover:bg-primary/12"
            >
              <Plus className="h-3.5 w-3.5" />
              Apply for Loan
            </button>
          </div>
          {data.loans.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No loans on record.</div>
          ) : (
            <div className="divide-y divide-border">
              {data.loans.map((l) => (
                <div key={l.loanNumber} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatMoneyFull(l.principal)}</p>
                    <p className="text-xs text-muted-foreground">{l.loanNumber} · {l.purpose} · {l.date}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    l.status === "ACTIVE" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    l.status === "REPAID" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    l.status === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-gray-50 text-gray-600 border-gray-200"
                  }`}>
                    {l.status === "PENDING" ? "Pending Review" : l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Powered by <Link to="/" className="text-primary font-medium hover:underline">Jollify</Link>
        </p>
      </main>

      {/* Submit Contribution Dialog */}
      {contribOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setContribOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Submit Contribution</h3>
              </div>
              <button onClick={() => { setContribOpen(false); setContribForm(EMPTY_CONTRIB); setContribError(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitContrib} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Record a payment you've made — your admin will confirm and approve it.</p>

              {contribError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{contribError}</div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Amount (₦) *</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 25000"
                  value={contribForm.amount}
                  onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Payment Channel *</label>
                <select
                  value={contribForm.channel}
                  onChange={(e) => setContribForm({ ...contribForm, channel: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select channel</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash Deposit</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Date Paid</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={contribForm.paidDate}
                    onChange={(e) => setContribForm({ ...contribForm, paidDate: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Receipt / Teller No.</label>
                  <input
                    type="text"
                    placeholder="Optional ref number"
                    value={contribForm.receiptNote}
                    onChange={(e) => setContribForm({ ...contribForm, receiptNote: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Additional Notes (optional)</label>
                <input
                  type="text"
                  placeholder="Any extra info for your admin…"
                  value={contribForm.notes}
                  onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setContribOpen(false); setContribForm(EMPTY_CONTRIB); setContribError(null); }}
                  className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contribLoading}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {contribLoading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : "Submit Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply for Loan Dialog */}
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

              {loanError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{loanError}</div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Loan Product *</label>
                <select
                  value={loanForm.productIndex}
                  onChange={(e) => {
                    const idx = e.target.value;
                    const p = LOAN_PRODUCTS[parseInt(idx, 10)];
                    setLoanForm({ ...loanForm, productIndex: idx, tenure: p ? String(p.maxMonths) : "" });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select a product</option>
                  {LOAN_PRODUCTS.map((p, i) => (
                    <option key={i} value={String(i)}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Amount (₦) *</label>
                  <input
                    type="number"
                    min="1000"
                    placeholder="e.g. 200000"
                    value={loanForm.principalNaira}
                    onChange={(e) => setLoanForm({ ...loanForm, principalNaira: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tenure (months)</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.maxMonths ?? 60}
                    placeholder={selectedProduct ? String(selectedProduct.maxMonths) : "e.g. 12"}
                    value={loanForm.tenure}
                    onChange={(e) => setLoanForm({ ...loanForm, tenure: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Purpose</label>
                <select
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select purpose (optional)</option>
                  {LOAN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="Additional context for your loan officer…"
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {showRepayment && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm space-y-1">
                  <p className="font-semibold text-emerald-800">Estimated repayment</p>
                  <p className="text-emerald-700">Monthly: <span className="font-bold">₦{monthly.toLocaleString("en-NG", { maximumFractionDigits: 0 })}</span></p>
                  <p className="text-emerald-700">Total repayable: <span className="font-bold">₦{(monthly * tenure).toLocaleString("en-NG", { maximumFractionDigits: 0 })}</span></p>
                  <p className="text-xs text-emerald-600 mt-1">Interest rate: {selectedProduct!.rate}% p.a.</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setLoanOpen(false); setLoanForm(EMPTY_LOAN); setLoanError(null); }}
                  className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loanLoading || !loanForm.productIndex || !loanForm.principalNaira}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loanLoading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberPortal;
