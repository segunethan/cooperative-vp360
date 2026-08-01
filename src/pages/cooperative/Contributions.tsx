import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PiggyBank,
  TrendingUp,
  Calendar,
  Plus,
  Download,
  FileDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { fetchAllContributions, recordMemberContribution, markContributionAsCompleted, markContributionAsFailed } from "@/lib/api/contributions";
import type { ContributionRow } from "@/lib/api/contributions";
import { formatMoney } from "@/lib/money";

const EMPTY_FORM = { memberId: "", amount: "", channel: "", notes: "", paidDate: "" };

const getStatusColor = (status: string) => {
  switch (status) {
    case "Completed": return "bg-success/10 text-success border-success/20";
    case "Pending":   return "bg-warning/10 text-warning border-warning/20";
    case "Failed":    return "bg-destructive/10 text-destructive border-destructive/20";
    default:          return "bg-muted/10 text-muted-foreground border-border";
  }
};

const Contributions = () => {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const queryClient = useQueryClient();

  const [recordOpen, setRecordOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: contributions = [], isLoading } = useQuery({
    queryKey: ["contributions"],
    queryFn: fetchAllContributions,
    enabled: !!tenant,
  });

  const ytdTotal = useMemo(
    () => contributions.filter((c) => c.status === "Completed").reduce((s, c) => s + c.amountKobo, 0),
    [contributions]
  );

  const thisMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  // ── Mutation ──────────────────────────────────────────────────────────────
  const recordMutation = useMutation({
    mutationFn: recordMemberContribution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast({ title: "Contribution Recorded", description: "Contribution recorded successfully." });
      setRecordOpen(false);
      setForm(EMPTY_FORM);
      setReceiptFile(null);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: markContributionAsCompleted,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast({ title: "Contribution Approved", description: "Marked as completed." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: markContributionAsFailed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      toast({ title: "Contribution Rejected", description: "Marked as failed." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!tenant?.id) return;
    if (!form.memberId.trim()) { setFormError("Enter a member ID (e.g. MEM-001)"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormError("Enter a valid amount in naira"); return; }
    if (!form.channel) { setFormError("Select a payment channel"); return; }

    const noteParts = [
      form.paidDate ? `Payment date: ${new Date(form.paidDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : null,
      receiptFile ? `Receipt: ${receiptFile.name}` : null,
      form.notes || null,
    ].filter(Boolean);

    recordMutation.mutate({
      tenantId: tenant.id,
      memberNumber: form.memberId.trim().toUpperCase(),
      amountNaira: parseFloat(form.amount),
      channel: form.channel,
      notes: noteParts.length ? noteParts.join(" | ") : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contributions & Shares</h1>
          <p className="text-muted-foreground">Track member contributions and shareholding</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Contribution
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contributions</p>
                {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                  <p className="text-2xl font-bold">{formatMoney(ytdTotal)}</p>
                )}
                <p className="text-xs text-muted-foreground">Year to Date</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Entries</p>
                {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : (
                  <p className="text-2xl font-bold">{contributions.length}</p>
                )}
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                {isLoading ? <Skeleton className="h-7 w-12 mt-1" /> : (
                  <p className="text-2xl font-bold">{contributions.filter((c) => c.status === "Pending").length}</p>
                )}
                <p className="text-xs text-muted-foreground">Member-submitted requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contributions Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Contribution Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : contributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <PiggyBank className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">No contributions yet</p>
                          <p className="text-sm text-muted-foreground mt-1">Record your first contribution to get started.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contributions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.date}</TableCell>
                      <TableCell>
                        <p className="font-medium">{c.member}</p>
                        <p className="text-xs text-muted-foreground">{c.memberId}</p>
                      </TableCell>
                      <TableCell className="font-medium">{c.amount}</TableCell>
                      <TableCell className="text-sm">{c.channel}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(c.status)}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.receiptUrl ? (
                          <a
                            href={c.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Download
                          </a>
                        ) : c.notes ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px] block" title={c.notes}>
                            {c.notes}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {c.status === "Pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-success hover:text-success"
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                onClick={() => approveMutation.mutate(c.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                onClick={() => rejectMutation.mutate(c.id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {c.status !== "Pending" && (
                            <Button variant="ghost" size="sm">View</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && contributions.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {contributions.length} contribution{contributions.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Contribution Dialog */}
      <Dialog open={recordOpen} onOpenChange={(o) => { setRecordOpen(o); if (!o) { setForm(EMPTY_FORM); setReceiptFile(null); setFormError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-primary" />
              Record Contribution
            </DialogTitle>
            <DialogDescription>
              Manually record a member contribution for cash deposits or offline bank transfers.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {formError}
            </div>
          )}

          <form onSubmit={handleRecord} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rc-member">Member ID</Label>
              <Input
                id="rc-member"
                placeholder="MEM-001"
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-amount">Amount (₦)</Label>
              <Input
                id="rc-amount"
                type="number"
                min="1"
                step="1"
                placeholder="25000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-channel">Payment Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger id="rc-channel"><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash Deposit</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="paystack">Paystack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rc-paid-date">Payment Date</Label>
                <Input
                  id="rc-paid-date"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={form.paidDate}
                  onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-notes">Notes (optional)</Label>
                <Input
                  id="rc-notes"
                  placeholder="Slip ID, reference…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-receipt">Receipt (optional)</Label>
              <Input
                id="rc-receipt"
                type="file"
                accept="image/*,.pdf"
                className="cursor-pointer file:mr-2 file:text-xs file:font-medium file:rounded file:border-0 file:bg-muted file:px-2 file:py-1"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile && (
                <p className="text-xs text-muted-foreground">Selected: {receiptFile.name}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setRecordOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={recordMutation.isPending}
              >
                {recordMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Recording…
                  </span>
                ) : (
                  "Record Contribution"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contributions;
