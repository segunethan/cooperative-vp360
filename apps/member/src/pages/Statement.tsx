import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Wallet, TrendingUp, Landmark } from "lucide-react";
import Papa from "papaparse";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import {
  fetchMemberStatementSummary,
  fetchMemberContributionsPage,
  fetchMemberLoansWithRepayments,
  type StatementContributionRow,
} from "@jollify/shared/lib/api/statement";
import { useMemberProfile } from "@/hooks/useMemberProfile";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const StatCard = ({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Wallet }) => (
  <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

const Statement = () => {
  const { data: profile } = useMemberProfile();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [contributions, setContributions] = useState<StatementContributionRow[]>([]);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["member-statement-summary", profile?.memberId],
    queryFn: fetchMemberStatementSummary,
    enabled: !!profile,
  });

  const { data: contribPage, isLoading: loadingContribs } = useQuery({
    queryKey: ["member-statement-contributions", profile?.memberId, cursor],
    queryFn: () => fetchMemberContributionsPage(profile!.memberId, cursor),
    enabled: !!profile,
  });

  // Keyset pagination returns one page per cursor — accumulate so "Load more"
  // appends rather than replacing the visible history.
  useEffect(() => {
    if (!contribPage) return;
    setContributions((prev) => (cursor ? [...prev, ...contribPage.rows] : contribPage.rows));
  }, [contribPage, cursor]);

  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ["member-statement-loans", profile?.memberId],
    queryFn: () => fetchMemberLoansWithRepayments(profile!.memberId),
    enabled: !!profile,
  });

  const exportCsv = () => {
    const csv = Papa.unparse(
      contributions.map((c) => ({
        Date: new Date(c.createdAt).toLocaleDateString("en-GB"),
        Period: c.periodMonth && c.periodYear ? `${MONTH_NAMES[c.periodMonth - 1]} ${c.periodYear}` : "",
        "Amount (NGN)": (c.amountKobo / 100).toFixed(2),
        Channel: c.channel,
        Status: c.status,
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${profile?.memberNumber ?? "member"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(14);
    doc.text(`${profile?.cooperativeName ?? "Cooperative"} — Member Statement`, 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`${profile?.fullName ?? ""} · ${profile?.memberNumber ?? ""}`, 14, y);
    y += 10;

    if (summary) {
      doc.setFontSize(11);
      doc.text("Summary", 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.text(`Total contributions: ${formatMoneyFull(summary.totalContributionsKobo)}`, 14, y); y += 5;
      doc.text(`Active loans: ${summary.activeLoanCount}`, 14, y); y += 5;
      doc.text(`Outstanding balance: ${formatMoneyFull(summary.totalOutstandingKobo)}`, 14, y); y += 10;
    }

    doc.setFontSize(11);
    doc.text("Contribution History", 14, y);
    y += 6;
    doc.setFontSize(8);
    for (const c of contributions) {
      if (y > 280) { doc.addPage(); y = 15; }
      doc.text(
        `${new Date(c.createdAt).toLocaleDateString("en-GB")}   ${formatMoneyFull(c.amountKobo)}   ${c.channel}   ${c.status}`,
        14,
        y
      );
      y += 5;
    }

    doc.save(`statement-${profile?.memberNumber ?? "member"}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Statement</h1>
          <p className="text-sm text-muted-foreground">Your contributions and loans with {profile?.cooperativeName}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 hover:bg-muted/50">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={exportPdf} className="flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 hover:bg-muted/50">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {loadingSummary ? (
        <div className="h-20 rounded-xl bg-muted/40 animate-pulse" />
      ) : summary && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Contributions" value={formatMoneyFull(summary.totalContributionsKobo)} icon={Wallet} />
          <StatCard label="Active Loans" value={String(summary.activeLoanCount)} icon={Landmark} />
          <StatCard label="Total Repaid" value={formatMoneyFull(summary.totalRepaidKobo)} icon={TrendingUp} />
          <StatCard label="Outstanding Balance" value={formatMoneyFull(summary.totalOutstandingKobo)} icon={Landmark} />
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Contribution History</p>
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Period</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Channel</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingContribs && contributions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Loading…</td></tr>
              ) : contributions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">No contributions yet.</td></tr>
              ) : (
                contributions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-3 py-2">{c.periodMonth && c.periodYear ? `${MONTH_NAMES[c.periodMonth - 1]} ${c.periodYear}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoneyFull(c.amountKobo)}</td>
                    <td className="px-3 py-2 capitalize">{c.channel.replace("_", " ")}</td>
                    <td className="px-3 py-2">{c.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {contribPage?.nextCursor && (
          <div className="flex justify-center pt-3">
            <button
              onClick={() => setCursor(contribPage.nextCursor!)}
              className="text-xs font-medium border rounded-lg px-3 py-1.5 hover:bg-muted/50"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Loans</p>
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Loan</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Principal</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Repaid</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingLoans ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Loading…</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">No loans yet.</td></tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 font-mono">{l.loanNumber}</td>
                    <td className="px-3 py-2 text-right">{formatMoneyFull(l.principalKobo)}</td>
                    <td className="px-3 py-2 text-right">{formatMoneyFull(l.totalRepaidKobo)}</td>
                    <td className="px-3 py-2">{l.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Statement;
