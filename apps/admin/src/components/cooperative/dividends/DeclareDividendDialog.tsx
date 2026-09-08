import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Badge } from "@jollify/shared/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@jollify/shared/components/ui/table";
import { TrendingUp, Users, AlertCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  previewDividend,
  declareDividend,
  formatDividendNaira,
  type MemberContributionSummary,
} from "@jollify/shared/lib/api/dividends";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeclared: () => void;
}

const EMPTY = { period: "", ratePercent: "", qualificationDate: "", payoutDate: "" };

const DeclareDividendDialog = ({ open, onClose, onDeclared }: Props) => {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"form" | "preview">("form");
  const [form, setForm] = useState(EMPTY);
  const [qualifying, setQualifying] = useState<MemberContributionSummary[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (f: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleClose = () => {
    setStep("form");
    setForm(EMPTY);
    setQualifying([]);
    setError(null);
    onClose();
  };

  const handlePreview = async () => {
    setError(null);
    const rate = parseFloat(form.ratePercent);
    if (!form.period.trim()) return setError("Period is required (e.g. Q2 2026).");
    if (!rate || rate <= 0 || rate > 100) return setError("Rate must be between 0.01% and 100%.");
    if (!form.qualificationDate) return setError("Qualification date is required.");

    setPreviewing(true);
    try {
      const result = await previewDividend(tenant!.id, rate, form.qualificationDate);
      setQualifying(result);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to preview dividend.");
    } finally {
      setPreviewing(false);
    }
  };

  const declareMutation = useMutation({
    mutationFn: () =>
      declareDividend(
        {
          tenantId: tenant!.id,
          period: form.period,
          ratePercent: parseFloat(form.ratePercent),
          qualificationDate: form.qualificationDate,
          payoutDate: form.payoutDate || undefined,
          declaredBy: user!.id,
        },
        qualifying
      ),
    onSuccess: () => {
      toast.success("Dividend declared successfully.");
      queryClient.invalidateQueries({ queryKey: ["dividends"] });
      onDeclared();
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPayout = qualifying.reduce(
    (sum, m) => sum + Math.floor((m.totalKobo * parseFloat(form.ratePercent || "0") * 100) / 10_000),
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Declare Dividend
          </DialogTitle>
          <DialogDescription>
            Set a rate against total contributions. Members with no contributions before the qualification date are excluded.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── Step 1: Form ── */}
        {step === "form" && (
          <div className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Period *</Label>
                <Input placeholder="e.g. Q2 2026 or FY 2026" value={form.period} onChange={set("period")} />
              </div>
              <div className="space-y-1.5">
                <Label>Dividend Rate (%) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  placeholder="e.g. 5.00"
                  value={form.ratePercent}
                  onChange={set("ratePercent")}
                />
                <p className="text-xs text-muted-foreground">Applied on each member's total contributions</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Qualification Date *</Label>
                <Input type="date" value={form.qualificationDate} onChange={set("qualificationDate")} />
                <p className="text-xs text-muted-foreground">Members must have contributions on or before this date</p>
              </div>
              <div className="space-y-1.5">
                <Label>Payout Date</Label>
                <Input type="date" value={form.payoutDate} onChange={set("payoutDate")} />
                <p className="text-xs text-muted-foreground">Optional — when payment will be made</p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handlePreview} disabled={previewing}>
                {previewing ? "Calculating…" : (
                  <>Preview Members <ChevronRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4 mt-1">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Qualifying Members</p>
                <p className="text-2xl font-bold text-foreground">{qualifying.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Rate Applied</p>
                <p className="text-2xl font-bold text-foreground">{form.ratePercent}%</p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Total Payout</p>
                <p className="text-lg font-bold text-primary">{formatDividendNaira(totalPayout)}</p>
              </div>
            </div>

            {qualifying.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center gap-2 text-muted-foreground">
                <Users className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">No qualifying members</p>
                <p className="text-xs">No active members had completed contributions on or before {form.qualificationDate}.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setStep("form")}>
                  Adjust settings
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead className="text-right">Contributions</TableHead>
                        <TableHead className="text-right">Dividend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qualifying.map((m) => {
                        const entitlement = Math.floor(
                          (m.totalKobo * parseFloat(form.ratePercent) * 100) / 10_000
                        );
                        return (
                          <TableRow key={m.memberId}>
                            <TableCell className="font-medium text-sm">{m.memberName}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{m.memberNumber}</TableCell>
                            <TableCell className="text-right text-sm">{formatDividendNaira(m.totalKobo)}</TableCell>
                            <TableCell className="text-right text-sm font-semibold text-primary">
                              {formatDividendNaira(entitlement)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <p className="text-xs text-muted-foreground">
                  Period: <strong>{form.period}</strong> · Qualification date: <strong>{form.qualificationDate}</strong>
                  {form.payoutDate && <> · Payout: <strong>{form.payoutDate}</strong></>}
                </p>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep("form")}>Back</Button>
                  <Button
                    onClick={() => declareMutation.mutate()}
                    disabled={declareMutation.isPending}
                  >
                    {declareMutation.isPending ? "Declaring…" : `Confirm & Declare`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeclareDividendDialog;
