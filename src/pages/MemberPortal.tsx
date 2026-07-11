import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, PiggyBank, CreditCard, BadgeCheck, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatMoneyFull } from "@/lib/money";

interface MemberData {
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

const MemberPortal = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const uid = session.user.id;

      // Fetch member record
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

      // Fetch contributions
      const { data: contribs } = await supabase
        .from("contributions")
        .select("amount_kobo, status, reference, created_at")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch loans
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
              <h2 className="font-semibold text-foreground text-sm">Recent Contributions</h2>
            </div>
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
                    {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loans */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">My Loans</h2>
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
                    {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
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
    </div>
  );
};

export default MemberPortal;
