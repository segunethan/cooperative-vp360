import { supabase } from "../supabase";
import { formatMoney } from "../money";

export interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  exitedMembers: number;
  totalContributionsYtdKobo: number;
  totalContributionsYtd: string;
  mtdContributionsKobo: number;
  mtdContributions: string;
  outstandingLoansKobo: number;
  outstandingLoans: string;
  dividendsPaidKobo: number;
  dividendsPaid: string;
  contributionGrowthPct: string;
}

export interface RecentActivityItem {
  id: string;
  type: "contribution" | "loan" | "member" | "announcement" | "dividend";
  message: string;
  time: string;
  status: "completed" | "pending" | "failed";
}

export const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [membersResult, ytdContribResult, mtdContribResult, activeLoansResult, dividendsResult] =
    await Promise.all([
      supabase.from("members").select("status"),
      supabase
        .from("contributions")
        .select("amount_kobo")
        .eq("status", "COMPLETED")
        .gte("created_at", ytdStart),
      supabase
        .from("contributions")
        .select("amount_kobo")
        .eq("status", "COMPLETED")
        .gte("created_at", mtdStart),
      supabase
        .from("loans")
        .select("principal_kobo")
        .eq("status", "ACTIVE"),
      supabase
        .from("dividends")
        .select("total_amount_kobo")
        .eq("status", "COMPLETED"),
    ]);

  const members = membersResult.data ?? [];
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;
  const pendingMembers = members.filter((m) => m.status === "INVITED").length;
  const exitedMembers = members.filter((m) => m.status === "EXITED").length;

  const ytdKobo = (ytdContribResult.data ?? []).reduce((s, r) => s + r.amount_kobo, 0);
  const mtdKobo = (mtdContribResult.data ?? []).reduce((s, r) => s + r.amount_kobo, 0);
  const loansKobo = (activeLoansResult.data ?? []).reduce((s, r) => s + r.principal_kobo, 0);
  const dividendsKobo = (dividendsResult.data ?? []).reduce((s, r) => s + r.total_amount_kobo, 0);

  return {
    totalMembers,
    activeMembers,
    pendingMembers,
    exitedMembers,
    totalContributionsYtdKobo: ytdKobo,
    totalContributionsYtd: formatMoney(ytdKobo),
    mtdContributionsKobo: mtdKobo,
    mtdContributions: formatMoney(mtdKobo),
    outstandingLoansKobo: loansKobo,
    outstandingLoans: formatMoney(loansKobo),
    dividendsPaidKobo: dividendsKobo,
    dividendsPaid: formatMoney(dividendsKobo),
    contributionGrowthPct: "+0%",
  };
};

export const fetchRecentActivity = async (): Promise<RecentActivityItem[]> => {
  const [contribsResult, membersResult, loansResult] = await Promise.all([
    supabase
      .from("contributions")
      .select("id, amount_kobo, status, created_at, member:members(full_name)")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("members")
      .select("id, full_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(2),
    supabase
      .from("loans")
      .select("id, loan_number, status, created_at, member:members(full_name)")
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const items: RecentActivityItem[] = [];

  for (const c of contribsResult.data ?? []) {
    const m = c.member as { full_name: string } | null;
    items.push({
      id: c.id,
      type: "contribution",
      message: `${m?.full_name ?? "A member"} contributed ₦${(c.amount_kobo / 100).toLocaleString("en-NG")}`,
      time: timeAgo(c.created_at),
      status: c.status === "COMPLETED" ? "completed" : c.status === "FAILED" ? "failed" : "pending",
    });
  }

  for (const mem of membersResult.data ?? []) {
    items.push({
      id: mem.id,
      type: "member",
      message: `New member ${mem.full_name} registered`,
      time: timeAgo(mem.created_at),
      status: mem.status === "ACTIVE" ? "completed" : "pending",
    });
  }

  for (const loan of loansResult.data ?? []) {
    const m = loan.member as { full_name: string } | null;
    items.push({
      id: loan.id,
      type: "loan",
      message: `Loan application ${loan.loan_number} from ${m?.full_name ?? "member"} — ${loan.status}`,
      time: timeAgo(loan.created_at),
      status: loan.status === "ACTIVE" ? "completed" : loan.status === "REJECTED" ? "failed" : "pending",
    });
  }

  return items.sort((a, b) => 0).slice(0, 5);
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
};
