import { useEffect, useState, useCallback, useRef } from "react";
import {
  Eye, EyeOff, LogOut, Search, ShieldAlert,
  LayoutDashboard, Building2, Users, RefreshCw,
  ChevronDown, ChevronUp, Ban, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
type AuthState = "checking" | "login" | "denied" | "dashboard";
type View = "overview" | "cooperatives" | "members";

interface Cooperative {
  id: string;
  name: string;
  slug: string;
  status: string;
  billing_plan: string;
  created_at: string;
  member_count: number;
  admin_count: number;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  member_number: string | null;
  tenant_id: string;
  tenants: { name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial:     "bg-blue-50 text-blue-700 border-blue-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  inactive:  "bg-stone-100 text-stone-500 border-stone-200",
};

const Badge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border"}`}>
    {status}
  </span>
);

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

const Spinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block border-2 border-current/20 border-t-current rounded-full animate-spin ${sm ? "h-3.5 w-3.5" : "h-5 w-5"}`} />
);

// ── Main Component ─────────────────────────────────────────────────────────────
const SuperAdmin = () => {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [view, setView] = useState<View>("overview");

  // Login state
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Data state
  const [coops, setCoops] = useState<Cooperative[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [coopsLoading, setCoopsLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Table UI
  const [coopSearch, setCoopSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all"); // tenant id or 'all'
  const [expandedCoop, setExpandedCoop] = useState<string | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, Member[]>>({});
  const [expandLoading, setExpandLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(null);

  // ── API helper ───────────────────────────────────────────────────────────────
  const call = useCallback(async (body: Record<string, unknown>) => {
    if (!sessionRef.current) {
      const { data: { session } } = await supabase.auth.getSession();
      sessionRef.current = session?.access_token ?? null;
    }
    if (!sessionRef.current) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-data`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionRef.current}`,
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

  // ── Auth check ───────────────────────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAuthState("login"); return; }
    sessionRef.current = session.access_token;

    const { data } = await supabase.from("super_admins").select("user_id").maybeSingle();
    setAuthState(data ? "dashboard" : "denied");
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // ── Load cooperatives ────────────────────────────────────────────────────────
  const loadCoops = useCallback(async () => {
    setCoopsLoading(true);
    setDataError(null);
    try {
      const data = await call({ action: "list" });
      setCoops(Array.isArray(data) ? data : []);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setCoopsLoading(false);
    }
  }, [call]);

  // ── Load all members ─────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setDataError(null);
    try {
      const data = await call({ action: "members" });
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  }, [call]);

  useEffect(() => {
    if (authState !== "dashboard") return;
    loadCoops();
  }, [authState, loadCoops]);

  useEffect(() => {
    if (authState !== "dashboard" || view !== "members") return;
    if (members.length === 0) loadMembers();
  }, [authState, view, members.length, loadMembers]);

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoginErr("Invalid credentials."); setLoginLoading(false); return; }
    await checkAuth();
    setLoginLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    sessionRef.current = null;
    setAuthState("login");
    setCoops([]);
    setMembers([]);
  };

  // ── Cooperative actions ──────────────────────────────────────────────────────
  const setCoopStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await call({ action: "set_status", tenantId: id, status });
      setCoops((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const toggleExpandCoop = async (id: string) => {
    if (expandedCoop === id) { setExpandedCoop(null); return; }
    setExpandedCoop(id);
    if (!expandedMembers[id]) {
      setExpandLoading(id);
      try {
        const data = await call({ action: "members", tenantId: id });
        setExpandedMembers((prev) => ({ ...prev, [id]: data }));
      } catch { /* ignore */ }
      setExpandLoading(null);
    }
  };

  // ── Member actions ───────────────────────────────────────────────────────────
  const setMemberStatus = async (memberId: string, status: string, fromExpanded?: string) => {
    setActionLoading(memberId);
    try {
      await call({ action: "set_member_status", memberId, status });
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, status } : m));
      if (fromExpanded) {
        setExpandedMembers((prev) => ({
          ...prev,
          [fromExpanded]: (prev[fromExpanded] ?? []).map((m) =>
            m.id === memberId ? { ...m, status } : m
          ),
        }));
      }
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = {
    total: coops.length,
    active: coops.filter((c) => c.status === "active" || c.status === "trial").length,
    suspended: coops.filter((c) => c.status === "suspended").length,
    members: coops.reduce((s, c) => s + (c.member_count ?? 0), 0),
  };

  const filteredCoops = coops.filter(
    (c) => c.name.toLowerCase().includes(coopSearch.toLowerCase()) ||
      c.slug.toLowerCase().includes(coopSearch.toLowerCase())
  );

  const filteredMembers = members.filter((m) => {
    const matchesCoop = memberFilter === "all" || m.tenant_id === memberFilter;
    const matchesSearch =
      m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearch.toLowerCase());
    return matchesCoop && matchesSearch;
  });

  // ── Checking ─────────────────────────────────────────────────────────────────
  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-[#012d1d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-white/40 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  // ── Denied ────────────────────────────────────────────────────────────────────
  if (authState === "denied") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="text-sm text-muted-foreground">Your account does not have super admin privileges.</p>
          <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────────
  if (authState === "login") {
    return (
      <div className="min-h-screen bg-[#012d1d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-white font-bold text-lg">J</span>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight block leading-none">Jollify</span>
              <span className="text-white/40 text-xs">Super Admin Console</span>
            </div>
          </div>

          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-8">
            <h1 className="text-white text-xl font-bold mb-1">Sign in</h1>
            <p className="text-white/40 text-sm mb-7">Super admin access only.</p>

            {loginErr && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-2 items-center">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {loginErr}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sa-email" className="text-white/60 text-sm">Email</Label>
                <Input id="sa-email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/8 border-white/15 text-white placeholder:text-white/25 h-10 focus-visible:ring-white/20 focus-visible:border-white/30"
                  placeholder="super@jollify.app"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa-pw" className="text-white/60 text-sm">Password</Label>
                <div className="relative">
                  <Input id="sa-pw" type={showPw ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/8 border-white/15 text-white placeholder:text-white/25 h-10 pr-10 focus-visible:ring-white/20 focus-visible:border-white/30"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loginLoading}
                className="w-full h-10 bg-white text-[#012d1d] hover:bg-white/90 font-semibold mt-1">
                {loginLoading
                  ? <span className="flex items-center gap-2"><Spinner sm /> Signing in…</span>
                  : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "overview",      label: "Overview",      icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "cooperatives",  label: "Cooperatives",  icon: <Building2 className="h-4 w-4" /> },
    { id: "members",       label: "All Members",   icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 bg-[#012d1d] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">J</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Jollify</p>
              <p className="text-white/35 text-[10px] mt-0.5">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-2 pb-2">Main</p>
          {navItems.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                view === id
                  ? "bg-white/12 text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/6"
              }`}
            >
              {icon}
              {label}
              {id === "cooperatives" && coops.length > 0 && (
                <span className="ml-auto text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">
                  {coops.length}
                </span>
              )}
              {id === "members" && members.length > 0 && (
                <span className="ml-auto text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">
                  {members.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-5 border-t border-white/8 pt-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-stone-200 px-7 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-foreground capitalize">
              {view === "overview" ? "Dashboard Overview" : view === "cooperatives" ? "Cooperatives" : "All Members"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {view === "overview" && "Platform-wide activity summary"}
              {view === "cooperatives" && `${coops.length} cooperative${coops.length !== 1 ? "s" : ""} registered`}
              {view === "members" && `${members.length} member${members.length !== 1 ? "s" : ""} across all cooperatives`}
            </p>
          </div>
          <button
            onClick={() => { loadCoops(); if (view === "members") loadMembers(); }}
            disabled={coopsLoading || membersLoading}
            className="p-2 rounded-lg border border-stone-200 text-muted-foreground hover:text-foreground hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${(coopsLoading || membersLoading) ? "animate-spin" : ""}`} />
          </button>
        </header>

        <main className="flex-1 p-7 space-y-6 overflow-auto">

          {dataError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2 items-center">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {dataError}
            </div>
          )}

          {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
          {view === "overview" && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: "Total Cooperatives", value: stats.total,     sub: "registered",         color: "text-foreground" },
                  { label: "Active",             value: stats.active,    sub: "cooperatives",        color: "text-emerald-600" },
                  { label: "Suspended",          value: stats.suspended, sub: "cooperatives",        color: "text-red-600" },
                  { label: "Total Members",      value: stats.members,   sub: "across all coops",    color: "text-foreground" },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-white border border-stone-200 rounded-xl p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={`text-4xl font-bold mt-2 ${color}`}>
                      {coopsLoading ? <span className="text-2xl text-muted-foreground/40">—</span> : value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Recent cooperatives preview */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                  <h2 className="font-semibold text-sm">Recent Cooperatives</h2>
                  <button onClick={() => setView("cooperatives")} className="text-xs text-primary hover:underline font-medium">
                    View all
                  </button>
                </div>
                {coopsLoading ? (
                  <div className="flex items-center justify-center py-12"><Spinner /></div>
                ) : coops.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No cooperatives yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Members</th>
                        <th className="px-4 py-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {coops.slice(0, 8).map((c) => (
                        <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">/{c.slug}</p>
                          </td>
                          <td className="px-4 py-3"><Badge status={c.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground">{c.member_count}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmt(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ══ COOPERATIVES ══════════════════════════════════════════════════ */}
          {view === "cooperatives" && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {/* Toolbar */}
              <div className="px-5 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="font-semibold text-sm flex-1">All Cooperatives</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search…" value={coopSearch} onChange={(e) => setCoopSearch(e.target.value)}
                    className="pl-8 h-8 text-sm w-60" />
                </div>
              </div>

              {coopsLoading ? (
                <div className="flex items-center justify-center py-16"><Spinner /></div>
              ) : filteredCoops.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {coopSearch ? "No cooperatives match your search." : "No cooperatives registered yet."}
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[1.5fr_1fr_80px_80px_100px_120px_110px] items-center bg-stone-50 border-b border-stone-100 px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Cooperative</span>
                    <span>Status</span>
                    <span>Members</span>
                    <span>Admins</span>
                    <span>Plan</span>
                    <span>Joined</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-stone-100">
                    {filteredCoops.map((c) => (
                      <div key={c.id}>
                        <div className="grid grid-cols-[1.5fr_1fr_80px_80px_100px_120px_110px] items-center px-5 py-3.5 hover:bg-stone-50 transition-colors">
                          {/* Name + expand */}
                          <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => toggleExpandCoop(c.id)}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                              {expandedCoop === c.id
                                ? <ChevronUp className="h-4 w-4" />
                                : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground">/{c.slug}</p>
                            </div>
                          </div>

                          <div><Badge status={c.status} /></div>
                          <div className="text-sm font-semibold text-foreground">{c.member_count}</div>
                          <div className="text-sm text-muted-foreground">{c.admin_count}</div>
                          <div className="capitalize text-xs text-muted-foreground bg-stone-100 px-2 py-0.5 rounded-full w-fit">{c.billing_plan ?? "free"}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{fmt(c.created_at)}</div>

                          {/* Action */}
                          <div className="flex justify-end">
                            {actionLoading === c.id ? (
                              <Spinner sm />
                            ) : c.status === "suspended" ? (
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setCoopStatus(c.id, "active")}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activate
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => setCoopStatus(c.id, "suspended")}>
                                <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded members */}
                        {expandedCoop === c.id && (
                          <div className="bg-stone-50/80 border-t border-stone-200 px-5 py-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                              Members — {c.name}
                            </p>
                            {expandLoading === c.id ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Spinner sm /> Loading…
                              </div>
                            ) : !expandedMembers[c.id]?.length ? (
                              <p className="text-sm text-muted-foreground">No members yet.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead className="bg-stone-50 border-b border-stone-200">
                                    <tr className="text-left text-xs text-muted-foreground">
                                      <th className="px-4 py-2.5 font-medium">Name</th>
                                      <th className="px-4 py-2.5 font-medium">Email</th>
                                      <th className="px-4 py-2.5 font-medium">Member #</th>
                                      <th className="px-4 py-2.5 font-medium">Status</th>
                                      <th className="px-4 py-2.5 font-medium">Joined</th>
                                      <th className="px-4 py-2.5 font-medium text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100">
                                    {expandedMembers[c.id].map((m) => (
                                      <tr key={m.id} className="hover:bg-stone-50">
                                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{m.full_name}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{m.email}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{m.member_number ?? "—"}</td>
                                        <td className="px-4 py-2.5"><Badge status={m.status} /></td>
                                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmt(m.created_at)}</td>
                                        <td className="px-4 py-2.5 text-right">
                                          {actionLoading === m.id ? <Spinner sm /> :
                                            m.status === "suspended" ? (
                                              <button onClick={() => setMemberStatus(m.id, "active", c.id)}
                                                className="text-xs font-medium text-emerald-600 hover:underline">Activate</button>
                                            ) : (
                                              <button onClick={() => setMemberStatus(m.id, "suspended", c.id)}
                                                className="text-xs font-medium text-red-600 hover:underline">Revoke</button>
                                            )}
                                        </td>
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
                </>
              )}
            </div>
          )}

          {/* ══ ALL MEMBERS ═══════════════════════════════════════════════════ */}
          {view === "members" && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="font-semibold text-sm flex-1">All Members</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    className="h-8 text-sm border border-input bg-background rounded-md px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">All cooperatives</option>
                    {coops.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Search member…" value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-8 h-8 text-sm w-52" />
                  </div>
                </div>
              </div>

              {membersLoading ? (
                <div className="flex items-center justify-center py-16"><Spinner /></div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {memberSearch || memberFilter !== "all" ? "No members match your filter." : "No members yet."}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1.5fr_1.5fr_1fr_100px_100px_120px_90px] items-center bg-stone-50 border-b border-stone-100 px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Cooperative</span>
                    <span>Member #</span>
                    <span>Status</span>
                    <span>Joined</span>
                    <span className="text-right">Action</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {filteredMembers.map((m) => (
                      <div key={m.id} className="grid grid-cols-[1.5fr_1.5fr_1fr_100px_100px_120px_90px] items-center px-5 py-3 hover:bg-stone-50 transition-colors">
                        <span className="font-medium text-sm text-foreground truncate pr-3">{m.full_name}</span>
                        <span className="text-sm text-muted-foreground truncate pr-3">{m.email}</span>
                        <span className="text-xs text-muted-foreground truncate pr-3">
                          {m.tenants?.name ?? "—"}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">{m.member_number ?? "—"}</span>
                        <span><Badge status={m.status} /></span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(m.created_at)}</span>
                        <div className="text-right">
                          {actionLoading === m.id ? <Spinner sm /> :
                            m.status === "suspended" ? (
                              <button onClick={() => setMemberStatus(m.id, "active")}
                                className="text-xs font-medium text-emerald-600 hover:underline">Activate</button>
                            ) : (
                              <button onClick={() => setMemberStatus(m.id, "suspended")}
                                className="text-xs font-medium text-red-600 hover:underline">Revoke</button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default SuperAdmin;
