import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@jollify/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { Badge } from "@jollify/shared/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { fetchProductSubscribers, type Product } from "@jollify/shared/lib/api/products";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { Users } from "lucide-react";

interface Props {
  product: Product | null;
  onClose: () => void;
}

const statusColor: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  PENDING: "bg-warning/10 text-warning border-warning/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  EXITED: "bg-muted text-muted-foreground border-border",
};

const ProductSubscribersDialog = ({ product, onClose }: Props) => {
  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["product-subscribers", product?.id],
    queryFn: () => fetchProductSubscribers(product!.id),
    enabled: !!product,
  });

  const activeCount = subscribers.filter((s) => s.status === "ACTIVE").length;
  const totalBalanceKobo = subscribers
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => sum + s.currentBalanceKobo, 0);

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Subscribers — {product?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Active Subscribers</p>
            <p className="text-xl font-bold text-foreground">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Total Balance Under Management</p>
            <p className="text-xl font-bold text-foreground">{formatMoneyFull(totalBalanceKobo)}</p>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : subscribers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No one has subscribed to this product yet.</TableCell></TableRow>
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
      </DialogContent>
    </Dialog>
  );
};

export default ProductSubscribersDialog;
