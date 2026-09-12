import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PiggyBank, TrendingUp, CreditCard, BadgeCheck, Plus, X, ShieldAlert, ChevronRight, LogOut } from "lucide-react";
import { supabase } from "@jollify/shared/lib/supabase";
import { formatMoneyFull, nairaToKobo, generatePaymentReference } from "@jollify/shared/lib/money";
import { fetchMemberSubscriptions } from "@jollify/shared/lib/api/products";
import { notifyRequestSubmitted } from "@jollify/shared/lib/api/products";
import { fetchOwnKyc, type KycSubmission } from "@jollify/shared/lib/api/kyc";
import { useAuth } from "@/context/AuthContext";
import { useMemberProfile } from "@/hooks/useMemberProfile";
import { useQuery } from "@tanstack/react-query";

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

const EMPTY_CONTRIB = { amount: "", channel: "", paidDate: "", notes: "" };

interface Contribution {
  date: string;
  amount: number;
  status: string;
  reference: string;
}

const Home = () => {
  const { signOut } = useAuth();
  const { data: profile, isLoading: loadingProfile, error: profileError } = useMemberProfile();

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadingContribs, setLoadingContribs] = useState(true);

  const [contribOpen, setContribOpen] = useState(false);
  const [contribForm, setContribForm] = useState(EMPTY_CONTRIB);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [contribError, setContribError] = useState<string | null>(null);
  const [contribLoading, setContribLoading] = useState(false);

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["member-subscriptions", profile?.memberId],
    queryFn: () => fetchMemberSubscriptions(profile!.memberId),
    enabled: !!profile,
  });

  const { data: kyc } = useQuery<KycSubmission | null>({
    queryKey: ["own-kyc", profile?.memberId],
    queryFn: () => fetchOwnKyc(profile!.memberId),
    enabled: !!profile,
  });

  const loadContributions = async () => {
    if (!profile) return;
    setLoadingContribs(true);
    const { data } = await supabase
      .from("contributions")
      .select("amount_kobo, status, reference, created_at")
      .eq("member_id", profile.memberId)
      .order("created_at", { ascending: false })
      .limit(10);
    setContributions(
      (data ?? []).map((c) => ({
        date: new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        amount: c.amount_kobo,
        status: c.status,
        reference: c.reference,
      }))
    );
    setLoadingContribs(false);
  };

  useEffect(() => { loadContributions(); }, [profile?.memberId]);

  const contributionTotal = contributions.filter((c) => c.status === "COMPLETED").reduce((s, c) => s + c.amount, 0);
  const investmentBalance = subscriptions.filter((s) => s.status === "ACTIVE").reduce((s, sub) => s + sub.currentBalanceKobo, 0);

  const handleSubmitContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    setContribError(null);
    if (!profile) return;
    if (!contribForm.amount || parseFloat(contribForm.amount) <= 0) { setContribError("Enter a valid amount"); return; }
    if (!contribForm.channel) { setContribError("Select a payment channel"); return; }
    setContribLoading(true);

    let receiptUrl: string | null = null;
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop() ?? "bin";
      const ref = generatePaymentReference("REC");
      const path = `${profile.tenantId}/${ref}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contribution-receipts")
        .upload(path, receiptFile, { contentType: receiptFile.type, upsert: false });
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("contribution-receipts").getPublicUrl(uploadData.path);
        receiptUrl = urlData.publicUrl;
      }
    }

    const noteParts = [
      contribForm.paidDate ? `Payment date: ${contribForm.paidDate}` : null,
      contribForm.notes || null,
    ].filter(Boolean);

    const { error } = await supabase.from("contributions").insert({
      tenant_id: profile.tenantId,
      member_id: profile.memberId,
      amount_kobo: nairaToKobo(parseFloat(contribForm.amount)),
      channel: contribForm.channel,
      status: "PENDING",
      reference: generatePaymentReference("CONTRIB"),
      notes: noteParts.length ? noteParts.join(" | ") : null,
      receipt_url: receiptUrl,
    });

    setContribLoading(false);
    if (error) { setContribError(error.message); return; }
    setContribOpen(false);
    setContribForm(EMPTY_CONTRIB);
    setReceiptFile(null);
    await notifyRequestSubmitted({
      tenantId: profile.tenantId,
      memberName: profile.fullName,
      cooperativeName: profile.cooperativeName,
      requestLabel: "Contribution",
      amountLabel: formatMoneyFull(nairaToKobo(parseFloat(contribForm.amount))),
    });
    await loadContributions();
  };

  if (loadingProfile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your account…</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-muted-foreground text-sm">{(profileError as Error)?.message}</p>
          <button onClick={() => signOut()} className="text-primary text-sm font-medium hover:underline">Sign out</button>
        </div>
      </div>
    );
  }

  const kycIncomplete = !profile.kycVerified;

  return (
    <div className="space-y-6">
      {/* Member ID card */}
      <div className="bg-[#012d1d] rounded-2xl p-6 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #c1ecd4 1px, transparent 0)`, backgroundSize: "24px 24px" }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">Member Account</p>
            <button onClick={() => signOut()} className="text-white/50 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{profile.fullName}</h1>
          <p className="text-white/50 text-sm mb-5">{profile.email}</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-white/40 text-[11px] uppercase tracking-wider mb-0.5">Member ID</p>
              <p className="text-white font-mono font-bold text-lg tracking-wider">{profile.memberNumber}</p>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <p className="text-white/40 text-[11px] uppercase tracking-wider mb-0.5">Status</p>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[profile.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {statusLabel[profile.status] ?? profile.status}
              </span>
            </div>
            {profile.kycVerified && (
              <>
                <div className="h-8 w-px bg-white/10 hidden sm:block" />
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                  <BadgeCheck className="h-4 w-4" /> KYC Verified
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KYC banner */}
      {kycIncomplete && (
        <Link
          to="/member/kyc"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 hover:bg-amber-100/70 transition-colors"
        >
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {kyc?.status === "REJECTED" ? "Your KYC was not approved" : kyc?.status === "PENDING" ? "KYC under review" : "Complete your KYC"}
            </p>
            <p className="text-xs text-amber-700">
              {kyc?.status === "REJECTED"
                ? kyc.rejectionReason ?? "Please review and resubmit your details."
                : kyc?.status === "PENDING"
                ? "Your submission is being reviewed by your cooperative admin."
                : "Required before you can withdraw from any investment product."}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-500 flex-shrink-0" />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><PiggyBank className="h-4 w-4 text-primary" /></div>
            <p className="text-sm text-muted-foreground font-medium">Contributions</p>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{formatMoneyFull(contributionTotal)}</p>
        </div>
        <Link to="/member/products" className="bg-white rounded-xl border border-border p-5 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-primary" /></div>
            <p className="text-sm text-muted-foreground font-medium">Investments</p>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{formatMoneyFull(investmentBalance)}</p>
        </Link>
        <Link to="/member/loans" className="bg-white rounded-xl border border-border p-5 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><CreditCard className="h-4 w-4 text-primary" /></div>
            <p className="text-sm text-muted-foreground font-medium">Loans</p>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">View</p>
        </Link>
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
            <Plus className="h-3.5 w-3.5" /> Submit Payment
          </button>
        </div>
        {loadingContribs ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : contributions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No contributions recorded yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {contributions.map((c) => (
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
              <button onClick={() => { setContribOpen(false); setContribForm(EMPTY_CONTRIB); setReceiptFile(null); setContribError(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitContrib} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Record a payment you've made — your admin will confirm and approve it.</p>

              {contribError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{contribError}</div>}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Amount (₦) *</label>
                <input
                  type="number" min="1" placeholder="e.g. 25000" value={contribForm.amount}
                  onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Payment Channel *</label>
                <select
                  value={contribForm.channel} onChange={(e) => setContribForm({ ...contribForm, channel: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select channel</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash Deposit</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Date Paid</label>
                <input
                  type="date" max={new Date().toISOString().split("T")[0]} value={contribForm.paidDate}
                  onChange={(e) => setContribForm({ ...contribForm, paidDate: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Receipt / Proof of Payment <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/4 transition-colors">
                  {receiptFile ? (
                    <div className="flex flex-col items-center gap-1 px-4 text-center">
                      <span className="text-sm font-medium text-foreground">{receiptFile.name}</span>
                      <span className="text-xs text-muted-foreground">{(receiptFile.size / 1024).toFixed(0)} KB · Click to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" /></svg>
                      <span className="text-xs font-medium">Upload receipt, teller slip, or bank screenshot</span>
                      <span className="text-xs">PNG, JPG, PDF — up to 5 MB</span>
                    </div>
                  )}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Additional Notes (optional)</label>
                <input
                  type="text" placeholder="Any extra info for your admin…" value={contribForm.notes}
                  onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setContribOpen(false); setContribForm(EMPTY_CONTRIB); setReceiptFile(null); setContribError(null); }}
                  className="flex-1 h-11 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={contribLoading}
                  className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {contribLoading ? (<><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>) : "Submit Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
