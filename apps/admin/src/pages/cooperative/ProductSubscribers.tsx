import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Button } from "@jollify/shared/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchProductById, fetchProductSubscribers } from "@jollify/shared/lib/api/products";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { ArrowLeft, Users, Receipt } from "lucide-react";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  PENDING: "bg-warning/10 text-warning border-warning/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  EXITED: "bg-muted text-muted-foreground border-border",
};

const ProductSubscribers = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const { data: product } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId!),
    enabled: !!productId,
  });

  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["product-subscribers", productId],
    queryFn: () => fetchProductSubscribers(productId!),
    enabled: !!productId,
  });

  const activeCount = subscribers.filter((s) => s.status === "ACTIVE").length;
  const totalBalanceKobo = subscribers.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + s.currentBalanceKobo, 0);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate("/cooperative/products")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Products
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Subscribers — {product?.name ?? "…"}
        </h1>
        <p className="text-muted-foreground">Every member subscribed to this product, their balance, and proof of funding.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active Subscribers</p>
            <p className="text-2xl font-bold text-foreground">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Balance Under Management</p>
            <p className="text-2xl font-bold text-foreground">{formatMoneyFull(totalBalanceKobo)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscribers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Funding</TableHead>
                  <TableHead>Invested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : subscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No one has subscribed to this product yet.</TableCell>
                  </TableRow>
                ) : (
                  subscribers.map((s) => (
                    <TableRow key={s.subscriptionId}>
                      <TableCell>
                        <p className="font-medium">{s.memberName}</p>
                        <p className="text-xs text-muted-foreground">{s.memberNumber}</p>
                      </TableCell>
                      <TableCell className="text-right">{formatMoneyFull(s.principalKobo)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoneyFull(s.currentBalanceKobo)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor[s.status]}>{s.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.fundingSource === "EXTERNAL_PAYMENT" ? (
                          s.receiptUrl ? (
                            <a href={s.receiptUrl} target="_blank" rel="noreferrer" className="text-primary text-xs font-medium hover:underline flex items-center gap-1">
                              <Receipt className="h-3 w-3" /> View Receipt
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">No receipt</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">From contributions</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.investedAt
                          ? new Date(s.investedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
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
  );
};

export default ProductSubscribers;
