import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@jollify/shared/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@jollify/shared/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@jollify/shared/components/ui/dialog";
import {
  FileText, Download, Clock, Eye, Loader2, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  requestReport, fetchReportRequests, reportTypeLabel, reportResultToCsvRows,
  type ReportType, type ReportRequestRow,
} from "@jollify/shared/lib/api/reports";
import { formatMoneyFull } from "@jollify/shared/lib/money";

const REPORT_TYPES = Object.keys(reportTypeLabel) as ReportType[];

// Only these report types are computed over a specific period — the rest
// (loan portfolio, member registry, dividend log) are point-in-time snapshots.
const PERIOD_TYPES: ReportType[] = ["CONTRIBUTION_SUMMARY", "FINANCIAL_STATEMENT"];

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-muted/50 text-muted-foreground border-border",
  PROCESSING: "bg-warning/10 text-warning border-warning/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
  FAILED: "bg-destructive/10 text-destructive border-destructive/20",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const downloadCsv = (rows: Record<string, unknown>[], filename: string) => {
  if (rows.length === 0) {
    toast.error("Nothing to export for this report.");
    return;
  }
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const koboField = (label: string, kobo?: number) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold">{formatMoneyFull(kobo ?? 0)}</span>
  </div>
);

const ReportResultView = ({ reportType, result }: { reportType: ReportType; result: any }) => {
  if (!result) return <p className="text-sm text-muted-foreground">No data.</p>;

  switch (reportType) {
    case "CONTRIBUTION_SUMMARY":
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {MONTHS[(result.periodMonth ?? 1) - 1]} {result.periodYear}
          </p>
          {koboField("Total Contributions", result.totalKobo)}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">Contribution Count</span>
            <span className="text-sm font-semibold">{result.contributionCount}</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">By Channel</p>
          {(result.byChannel ?? []).map((c: any) => (
            <div key={c.channel} className="flex items-center justify-between py-1 text-sm">
              <span className="capitalize">{c.channel?.replace("_", " ")}</span>
              <span>{formatMoneyFull(c.totalKobo)} ({c.count})</span>
            </div>
          ))}
        </div>
      );
    case "LOAN_PORTFOLIO":
      return (
        <div className="space-y-3">
          {koboField("Outstanding Principal", result.outstandingPrincipalKobo)}
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Active Loans</span>
            <span className="text-sm font-semibold">{result.activeLoanCount}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">Overdue Installments</span>
            <span className="text-sm font-semibold text-destructive">
              {result.overdueLoanCount} ({formatMoneyFull(result.overdueAmountKobo)})
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">By Status</p>
          {(result.byStatus ?? []).map((s: any) => (
            <div key={s.status} className="flex items-center justify-between py-1 text-sm">
              <span>{s.status}</span>
              <span>{s.count} loan(s) · {formatMoneyFull(s.principalKobo)}</span>
            </div>
          ))}
        </div>
      );
    case "MEMBER_REGISTRY":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Total Members</span>
            <span className="text-sm font-semibold">{result.totalMembers}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground">KYC Verified</span>
            <span className="text-sm font-semibold">{result.kycVerifiedCount}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">New This Month</span>
            <span className="text-sm font-semibold">{result.newThisMonth}</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">By Status</p>
          {(result.byStatus ?? []).map((s: any) => (
            <div key={s.status} className="flex items-center justify-between py-1 text-sm">
              <span>{s.status}</span>
              <span>{s.count}</span>
            </div>
          ))}
        </div>
      );
    case "DIVIDEND_DISTRIBUTION":
      return (
        <div className="space-y-2">
          {(result.dividends ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No dividends declared yet.</p>
          ) : (
            result.dividends.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-sm">
                <div>
                  <p className="font-medium">{d.period}</p>
                  <p className="text-xs text-muted-foreground">{d.ratePct}% · {d.paidCount}/{d.eligibleMembers} paid</p>
                </div>
                <span className="font-semibold">{formatMoneyFull(d.totalAmountKobo)}</span>
              </div>
            ))
          )}
        </div>
      );
    case "FINANCIAL_STATEMENT":
      return (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground mb-2">Year {result.periodYear}</p>
          {koboField("Total Contributions", result.totalContributionsKobo)}
          {koboField("Loans Disbursed", result.totalLoansDisbursedKobo)}
          {koboField("Repayments Received", result.totalRepaymentsReceivedKobo)}
          {koboField("Dividends Paid", result.totalDividendsPaidKobo)}
          {koboField("Outstanding Loan Principal", result.outstandingLoanPrincipalKobo)}
        </div>
      );
    default:
      return null;
  }
};

const Reports = () => {
  const queryClient = useQueryClient();
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>("CONTRIBUTION_SUMMARY");
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [viewing, setViewing] = useState<ReportRequestRow | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["report-requests"],
    queryFn: () => fetchReportRequests(),
    // Only keep polling while something is in flight — a finished queue
    // (the common case) costs nothing extra.
    refetchInterval: (query) => {
      const rows = query.state.data as ReportRequestRow[] | undefined;
      const pending = rows?.some((r) => r.status === "QUEUED" || r.status === "PROCESSING");
      return pending ? 3000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: (type: ReportType) => {
      const params = PERIOD_TYPES.includes(type)
        ? type === "CONTRIBUTION_SUMMARY"
          ? { period_month: periodMonth, period_year: periodYear }
          : { period_year: periodYear }
        : {};
      return requestReport(type, params);
    },
    onSuccess: () => {
      toast.success("Report queued — it'll be ready in a moment.");
      queryClient.invalidateQueries({ queryKey: ["report-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDownload = (row: ReportRequestRow) => {
    const rows = reportResultToCsvRows(row.reportType, row.result ?? {});
    downloadCsv(rows, `${reportTypeLabel[row.reportType].toLowerCase().replace(/\s+/g, "-")}-${row.id.slice(0, 8)}.csv`);
  };

  const reportsThisMonth = requests.filter((r) => new Date(r.requestedAt).getMonth() === now.getMonth()).length;
  const pendingCount = requests.filter((r) => r.status === "QUEUED" || r.status === "PROCESSING").length;
  const lastCompleted = requests.find((r) => r.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Compliance</h1>
        <p className="text-muted-foreground">Generate operational and financial reports on demand</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reports Generated</p>
                <p className="text-2xl font-bold">{reportsThisMonth}</p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning/10 rounded-lg"><Clock className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Queued or processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success/10 rounded-lg"><ListChecks className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Completed</p>
                <p className="text-lg font-bold">{lastCompleted ? reportTypeLabel[lastCompleted.reportType] : "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {lastCompleted?.completedAt ? new Date(lastCompleted.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "No reports yet"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generate a report */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Generate a Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{reportTypeLabel[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {PERIOD_TYPES.includes(reportType) && (
                <div className="grid grid-cols-2 gap-3">
                  {reportType === "CONTRIBUTION_SUMMARY" && (
                    <div className="space-y-1.5">
                      <Label>Month</Label>
                      <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <Input
                      type="number" value={periodYear}
                      onChange={(e) => setPeriodYear(parseInt(e.target.value) || now.getFullYear())}
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full" disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate(reportType)}
              >
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate Report
              </Button>
              <p className="text-xs text-muted-foreground">
                Reports run in the background — this queues it and a worker picks it up within a minute.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Report history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Report History</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : requests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                            <FileText className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">No reports generated yet</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      requests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{reportTypeLabel[r.reportType]}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(r.requestedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[r.status]}>
                              {(r.status === "QUEUED" || r.status === "PROCESSING") && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" disabled={r.status !== "COMPLETED"} onClick={() => setViewing(r)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" disabled={r.status !== "COMPLETED"} onClick={() => handleDownload(r)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audit trail — not yet built; flagged honestly rather than shown with fake data */}
      <Card>
        <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
            <ListChecks className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Not yet available</p>
            <p className="text-sm max-w-sm mt-1">
              A real audit trail needs action logging wired across the app — a separate piece of work from the report module above.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewing && reportTypeLabel[viewing.reportType]}</DialogTitle>
          </DialogHeader>
          {viewing && <ReportResultView reportType={viewing.reportType} result={viewing.result} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
