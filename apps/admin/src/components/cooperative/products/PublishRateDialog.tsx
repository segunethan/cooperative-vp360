import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publishProductRate, fetchLatestRateUpdate, type Product } from "@jollify/shared/lib/api/products";
import { toast } from "sonner";
import { TrendingUp, AlertCircle } from "lucide-react";

interface Props {
  product: Product | null;
  onClose: () => void;
}

const PublishRateDialog = ({ product, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: latest } = useQuery({
    queryKey: ["product-latest-rate", product?.id],
    queryFn: () => fetchLatestRateUpdate(product!.id),
    enabled: !!product,
  });

  const mutation = useMutation({
    mutationFn: () => publishProductRate(product!.id, parseFloat(rate), note),
    onSuccess: () => {
      toast.success(`Rate published for ${product?.name}. Every active subscriber's balance has been updated.`);
      queryClient.invalidateQueries({ queryKey: ["product-latest-rate", product?.id] });
      handleClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleClose = () => {
    setRate("");
    setNote("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Publish Rate — {product?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="rounded-md bg-muted/50 border px-4 py-3 text-sm">
            {latest ? (
              <p className="text-muted-foreground">
                Last published: <span className="font-semibold text-foreground">{latest.ratePercent}%</span> on{" "}
                {new Date(latest.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            ) : (
              <p className="text-muted-foreground">No rate has been published for this product yet.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Rate to apply this period (%) *</Label>
            <Input
              type="number" step={0.01} placeholder="e.g. 2"
              value={rate} onChange={(e) => setRate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This grows every active subscriber's current balance by this percentage, immediately.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea placeholder="e.g. Q1 2026 mutual fund return" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button disabled={!rate || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Publishing…" : "Publish Rate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PublishRateDialog;
