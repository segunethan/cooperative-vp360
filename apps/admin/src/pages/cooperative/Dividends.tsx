import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@jollify/shared/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@jollify/shared/components/ui/collapsible";
import {
  TrendingUp, ChevronDown, Users, Calendar, Plus, Banknote,
} from "lucide-react";
import { fetchAllDividends, fetchDividendEntitlements } from "@jollify/shared/lib/api/dividends";
import DeclareDividendDialog from "@/components/cooperative/dividends/DeclareDividendDialog";

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      "bg-muted/50 text-muted-foreground border-border",
  DECLARED:   "bg-primary/10 text-primary border-primary/20",
  PROCESSING: "bg-warning/10 text-warning border-warning/20",
  COMPLETED:  "bg-success/10 text-success border-success/20",
};

const DividendEntitlementsRow = ({ dividendId }: { dividendId: string }) => {
  const { data: entitlements = [], isLoading } = useQuery({
    queryKey: ["dividend-entitlements", dividendId],
    queryFn: () => fetchDividendEntitlements(dividendId),
  });

  if (isLoading) return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  );

  return (
    <div className="border-t border-border bg-muted/20">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Member</TableHead>
            <TableHead>ID</TableHead>
            <TableHead className="text-right">Total Contributions</TableHead>
            <TableHead className="text-right">Dividend</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entitlements.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="pl-6 font-medium text-sm">{e.memberName}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{e.memberNumber}</TableCell>
              <TableCell className="text-right text-sm">{e.contributionTotal}</TableCell>
              <TableCell className="text-right text-sm font-semibold text-primary">{e.entitlement}</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className={e.paidAt
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted/50 text-muted-foreground border-border"
                }>
                  {e.paidAt ? `Paid ${e.paidAt}` : "Pending"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const Dividends = () => {
  const { tenant } = useAuth();
  const [declareOpen, setDeclareOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: dividends = [], isLoading, refetch } = useQuery({
    queryKey: ["dividends"],
    queryFn: fetchAllDividends,
    enabled: !!tenant,
  });

  const totalPaidKobo = dividends
    .filter((d) => d.status === "COMPLETED")
    .reduce((sum, d) => sum + d.totalAmountKobo, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dividends</h1>
          <p className="text-muted-foreground">Declare and manage member dividend payouts</p>
        </div>
        <Button onClick={() => setDeclareOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Declare Dividend
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Declared</p>
                <p className="text-2xl font-bold">{dividends.filter((d) => d.status !== "DRAFT").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid Out</p>
                <p className="text-2xl font-bold">
                  {totalPaidKobo > 0
                    ? `₦${(totalPaidKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Latest Period</p>
                <p className="text-lg font-bold">{dividends[0]?.period ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dividend list */}
      <Card>
        <CardHeader>
          <CardTitle>Dividend History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : dividends.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center gap-3 text-muted-foreground">
              <TrendingUp className="h-10 w-10 opacity-20" />
              <p className="font-medium">No dividends declared yet</p>
              <p className="text-sm max-w-xs">
                When you declare a dividend, it will appear here with a full breakdown per member.
              </p>
              <Button size="sm" className="mt-2" onClick={() => setDeclareOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Declare your first dividend
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dividends.map((d) => (
                <Collapsible
                  key={d.id}
                  open={expandedId === d.id}
                  onOpenChange={(open) => setExpandedId(open ? d.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{d.period}</span>
                          <Badge variant="outline" className={STATUS_COLORS[d.status] ?? STATUS_COLORS.DRAFT}>
                            {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />{d.eligibleMembers} members
                          </span>
                          <span>Rate: {d.ratePct.toFixed(2)}%</span>
                          {d.qualificationDate && <span>Qualified by: {d.qualificationDate}</span>}
                          {d.payoutDate && <span>Payout: {d.payoutDate}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground">{d.totalAmount}</p>
                        <p className="text-xs text-muted-foreground">{d.declaredAt ?? d.createdAt}</p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === d.id ? "rotate-180" : ""}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <DividendEntitlementsRow dividendId={d.id} />
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeclareDividendDialog
        open={declareOpen}
        onClose={() => setDeclareOpen(false)}
        onDeclared={refetch}
      />
    </div>
  );
};

export default Dividends;
