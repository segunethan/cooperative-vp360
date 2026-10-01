import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@jollify/shared/components/ui/select";
import { Input } from "@jollify/shared/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@jollify/shared/components/ui/table";
import { Wallet, RefreshCw, Lock, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  generatePayrollDues,
  createPayrollBatch,
  fetchPayrollBatches,
  fetchPayrollBatchItems,
  lockPayrollBatch,
  reconcilePayrollItem,
  downloadPayrollBatchCsv,
  formatPayrollAmount,
  type PayrollBatchItem,
} from "@jollify/shared/lib/api/payroll";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      "bg-muted/50 text-muted-foreground border-border",
  LOCKED:     "bg-warning/10 text-warning border-warning/20",
  EXPORTED:   "bg-primary/10 text-primary border-primary/20",
  RECONCILED: "bg-success/10 text-success border-success/20",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING:      "bg-muted/50 text-muted-foreground border-border",
  DEDUCTED:     "bg-success/10 text-success border-success/20",
  PARTIAL:      "bg-warning/10 text-warning border-warning/20",
  NOT_DEDUCTED: "bg-destructive/10 text-destructive border-destructive/20",
};

const ReconcileRow = ({ batchId, item }: { batchId: string; item: PayrollBatchItem }) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(item.total_amount_kobo / 100));

  const mutation = useMutation({
    mutationFn: (status: "DEDUCTED" | "PARTIAL" | "NOT_DEDUCTED") =>
      reconcilePayrollItem(item.id, status, status === "NOT_DEDUCTED" ? 0 : parseFloat(amount)),
    onSuccess: () => {
      toast.success("Item reconciled.");
      queryClient.invalidateQueries({ queryKey: ["payroll-batch-items", batchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{item.staff_id ?? "—"}</TableCell>
      <TableCell>{item.member?.full_name ?? "—"}</TableCell>
      <TableCell>{formatPayrollAmount(item.contribution_amount_kobo)}</TableCell>
      <TableCell>{formatPayrollAmount(item.loan_installment_amount_kobo)}</TableCell>
      <TableCell className="font-medium">{formatPayrollAmount(item.total_amount_kobo)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={ITEM_STATUS_COLORS[item.status]}>{item.status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {item.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1.5">
            <Input
              type="number" className="h-8 w-24 text-xs"
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
            <Button size="sm" variant="outline" className="h-8" disabled={mutation.isPending} onClick={() => mutation.mutate("DEDUCTED")}>
              Deducted
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-destructive" disabled={mutation.isPending} onClick={() => mutation.mutate("NOT_DEDUCTED")}>
              Not Deducted
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {item.status === "NOT_DEDUCTED" ? "—" : formatPayrollAmount(item.total_amount_kobo)}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
};

const Payroll = () => {
  const queryClient = useQueryClient();
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data: batches = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["payroll-batches"],
    queryFn: () => fetchPayrollBatches(),
  });

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const [loadedItems, setLoadedItems] = useState<PayrollBatchItem[]>([]);

  const { data: itemsPage, isLoading: loadingItems } = useQuery({
    queryKey: ["payroll-batch-items", selectedBatchId, cursor],
    queryFn: () => fetchPayrollBatchItems(selectedBatchId!, cursor),
    enabled: !!selectedBatchId,
  });

  // Keyset pagination returns one page per cursor — accumulate pages here so
  // "Load more" appends instead of replacing what's already on screen.
  useEffect(() => {
    if (!itemsPage) return;
    setLoadedItems((prev) => (cursor ? [...prev, ...itemsPage.items] : itemsPage.items));
  }, [itemsPage, cursor]);

  const generateDuesMutation = useMutation({
    mutationFn: () => generatePayrollDues(periodMonth, periodYear),
    onSuccess: (count) => toast.success(`${count} due(s) generated for ${MONTHS[periodMonth - 1]} ${periodYear}.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const createBatchMutation = useMutation({
    mutationFn: () => createPayrollBatch(periodMonth, periodYear),
    onSuccess: (batch) => {
      toast.success(`Batch ready with ${batch?.member_count ?? 0} member(s).`);
      queryClient.invalidateQueries({ queryKey: ["payroll-batches"] });
      if (batch) setSelectedBatchId(batch.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockMutation = useMutation({
    mutationFn: (batchId: string) => lockPayrollBatch(batchId),
    onSuccess: () => {
      toast.success("Batch locked — ready to export.");
      queryClient.invalidateQueries({ queryKey: ["payroll-batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = async (batchId: string, month: number, year: number) => {
    try {
      await downloadPayrollBatchCsv(batchId, `payroll-${year}-${String(month).padStart(2, "0")}.csv`);
      queryClient.invalidateQueries({ queryKey: ["payroll-batches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Payroll Deductions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a per-cycle deduction report for members on payroll, then reconcile what HR actually deducted.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate for a period</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Month</label>
            <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(parseInt(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Year</label>
            <Input
              type="number" className="w-28"
              value={periodYear} onChange={(e) => setPeriodYear(parseInt(e.target.value) || now.getFullYear())}
            />
          </div>
          <Button variant="outline" disabled={generateDuesMutation.isPending} onClick={() => generateDuesMutation.mutate()}>
            {generateDuesMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Generate Dues
          </Button>
          <Button disabled={createBatchMutation.isPending} onClick={() => createBatchMutation.mutate()}>
            {createBatchMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wallet className="h-4 w-4 mr-1.5" />}
            Generate Batch
          </Button>
          <p className="text-xs text-muted-foreground basis-full">
            "Generate Dues" computes what every member owes this cycle (contribution + loan installment).
            "Generate Batch" packages the open dues for PAYROLL-deduction members into an exportable report.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBatches ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : batches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payroll batches yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow
                    key={b.id}
                    className={b.id === selectedBatchId ? "bg-muted/40" : "cursor-pointer"}
                    onClick={() => { setSelectedBatchId(b.id); setCursor(undefined); setLoadedItems([]); }}
                  >
                    <TableCell>{MONTHS[b.period_month - 1]} {b.period_year}</TableCell>
                    <TableCell>{b.member_count}</TableCell>
                    <TableCell>{formatPayrollAmount(b.total_amount_kobo)}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_COLORS[b.status]}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      {b.status === "DRAFT" && (
                        <Button size="sm" variant="outline" disabled={lockMutation.isPending} onClick={() => lockMutation.mutate(b.id)}>
                          <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock
                        </Button>
                      )}
                      {(b.status === "LOCKED" || b.status === "EXPORTED") && (
                        <Button size="sm" variant="outline" onClick={() => handleExport(b.id, b.period_month, b.period_year)}>
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {MONTHS[selectedBatch.period_month - 1]} {selectedBatch.period_year} — Line Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingItems && loadedItems.length === 0 ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : loadedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No line items in this batch.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff ID</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Contribution</TableHead>
                      <TableHead>Loan Installment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Reconcile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadedItems.map((item) => (
                      <ReconcileRow key={item.id} batchId={selectedBatch.id} item={item} />
                    ))}
                  </TableBody>
                </Table>
                {itemsPage?.nextCursor && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" size="sm" onClick={() => setCursor(itemsPage.nextCursor!)}>
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Payroll;
