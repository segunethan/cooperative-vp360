import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, LogOut, ChevronDown, ChevronUp, Search, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type AuthState = "checking" | "login" | "denied" | "dashboard";

interface Cooperative {
  id: string;
  name: string;
  slug: string;
  status: string;
  billing_plan: string;
  created_at: string;
  cooperative_number: string | null;
  member_count: number;
  admin_count: number;
  [key: string]: unknown;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  member_number: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial: "bg-blue-50 text-blue-700 border-blue-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border"}`}>
    {status}
  </span>
);

const fmt = (date: string) =>
  new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

// ── Super Admin Page ──────────────────────────────────────────────────────────
const SuperAdmin = () => {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [membersLoading, setMembersLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const callSuperAdmin = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-data`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }, []);

  const loadCooperatives = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await callSuperAdmin({ action: "list" });
      setCooperatives(data);
    } catch {
      // silent — if forbidden, authState handles it
    } finally {
      setDataLoading(false);
    }
  }, [callSuperAdmin]);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAuthState("login"); return; }

    const { data } = await supabase.from("super_admins").select("user_id").maybeSingle();
    if (!data) { setAuthState("denied"); return; }

    setAuthState("dashboard");
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (authState === "dashboard") loadCooperatives();
  }, [authState, loadCooperatives]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) {
      setLoginError("Invalid credentials.");
      setLoginLoading(false);
      return;
    }
    await checkAuth();
    setLoginLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthState("login");
    setCooperatives([]);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!members[id]) {
      setMembersLoading(id);
      try {
        const data = await callSuperAdmin({ action: "members", tenantId: id });
        setMembers((prev) => ({ ...prev, [id]: data }));
      } catch { /* ignore */ }
      setMembersLoading(null);
    }
  };

  const handleSetStatus = async (tenantId: string, newStatus: string) => {
    setActionLoading(tenantId);
    try {
      await callSuperAdmin({ action: "set_status", tenantId, status: newStatus });
      setCooperatives((prev) =>
        prev.map((c) => (c.id === tenantId ? { ...c, status: newStatus } : c))
      );
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const filtered = cooperatives.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: cooperatives.length,
    active: cooperatives.filter((c) => c.status === "active").length,
    suspended: cooperatives.filter((c) => c.status === "suspended").length,
    members: cooperatives.reduce((sum, c) => sum + c.member_count, 0),
  };

  // ── Checking ────────────────────────────────────────────────────────────────
  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-[#012d1d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  // ── Denied ──────────────────────────────────────────────────────────────────
  if (authState === "denied") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have super admin privileges.
          </p>
          <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  if (authState === "login") {
    return (
      <div className="min-h-screen bg-[#012d1d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-white font-bold text-lg">J</span>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight block leading-none">Jollify</span>
              <span className="text-white/40 text-xs">Super Admin Console</span>
            </div>
          </div>

          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8 backdrop-blur">
            <h1 className="text-white text-xl font-bold mb-1">Sign in</h1>
            <p className="text-white/50 text-sm mb-7">Super admin access only.</p>

            {loginError && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sa-email" className="text-white/70 text-sm">Email</Label>
                <Input
                  id="sa-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-10 focus:border-white/40 focus:ring-white/10"
                  placeholder="super@jollify.app"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-password" className="text-white/70 text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="sa-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-10 pr-10 focus:border-white/40 focus:ring-white/10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full h-10 bg-white text-[#012d1d] hover:bg-white/90 font-semibold mt-2"
              >
                {loginLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-[#012d1d]/30 border-t-[#012d1d] rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      {/* Top bar */}
      <header className="bg-[#012d1d] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white font-bold text-sm">J</span>
          </div>
          <div>
            <span className="text-white font-semibold text-sm tracking-tight">Jollify</span>
            <span className="text-white/40 text-xs ml-2">Super Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCooperatives}
            disabled={dataLoading}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Cooperatives", value: stats.total, color: "text-foreground" },
            { label: "Active", value: stats.active, color: "text-emerald-600" },
            { label: "Suspended", value: stats.suspended, color: "text-red-600" },
            { label: "Total Members", value: stats.members, color: "text-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Cooperatives table */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-foreground text-sm">Registered Cooperatives</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or slug…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {search ? "No cooperatives match your search." : "No cooperatives registered yet."}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filtered.map((coop) => (
                <div key={coop.id}>
                  {/* Main row */}
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors">
                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(coop.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      {expandedId === coop.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {/* Name + slug */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{coop.name}</p>
                      <p className="text-xs text-muted-foreground">/{coop.slug}</p>
                    </div>

                    {/* Status */}
                    <StatusBadge status={coop.status} />

                    {/* Counts */}
                    <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
                      <span><strong className="text-foreground">{coop.member_count}</strong> members</span>
                      <span><strong className="text-foreground">{coop.admin_count}</strong> admins</span>
                    </div>

                    {/* Plan */}
                    <span className="hidden md:block text-xs text-muted-foreground capitalize bg-stone-100 px-2 py-0.5 rounded-full">
                      {coop.billing_plan ?? "free"}
                    </span>

                    {/* Joined */}
                    <span className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(coop.created_at)}
                    </span>

                    {/* Action */}
                    {coop.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        disabled={actionLoading === coop.id}
                        onClick={() => handleSetStatus(coop.id, "active")}
                      >
                        {actionLoading === coop.id ? "…" : "Activate"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        disabled={actionLoading === coop.id}
                        onClick={() => handleSetStatus(coop.id, "suspended")}
                      >
                        {actionLoading === coop.id ? "…" : "Suspend"}
                      </Button>
                    )}
                  </div>

                  {/* Expanded members */}
                  {expandedId === coop.id && (
                    <div className="bg-stone-50 border-t border-stone-100 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Members of {coop.name}
                      </p>
                      {membersLoading === coop.id ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                          Loading members…
                        </div>
                      ) : !members[coop.id]?.length ? (
                        <p className="text-sm text-muted-foreground py-2">No members yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-muted-foreground">
                                <th className="pb-2 font-medium pr-6">Name</th>
                                <th className="pb-2 font-medium pr-6">Email</th>
                                <th className="pb-2 font-medium pr-6">Phone</th>
                                <th className="pb-2 font-medium pr-6">Member #</th>
                                <th className="pb-2 font-medium pr-6">Status</th>
                                <th className="pb-2 font-medium">Joined</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                              {members[coop.id].map((m) => (
                                <tr key={m.id} className="text-foreground">
                                  <td className="py-2 pr-6 font-medium whitespace-nowrap">{m.full_name}</td>
                                  <td className="py-2 pr-6 text-muted-foreground">{m.email}</td>
                                  <td className="py-2 pr-6 text-muted-foreground">{m.phone ?? "—"}</td>
                                  <td className="py-2 pr-6 text-muted-foreground font-mono text-xs">{m.member_number ?? "—"}</td>
                                  <td className="py-2 pr-6"><StatusBadge status={m.status} /></td>
                                  <td className="py-2 text-muted-foreground whitespace-nowrap">{fmt(m.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SuperAdmin;
