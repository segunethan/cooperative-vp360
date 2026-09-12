import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProduct, updateProduct, type Product, type ProductType, type ProductStatus } from "@jollify/shared/lib/api/products";
import { nairaToKobo } from "@jollify/shared/lib/money";
import { toast } from "sonner";
import { PiggyBank, TrendingUp, Wallet, Banknote, Coins, AlertCircle } from "lucide-react";

const ICONS = [
  { value: "piggy-bank", label: "Piggy Bank", Icon: PiggyBank },
  { value: "trending-up", label: "Trending Up", Icon: TrendingUp },
  { value: "wallet", label: "Wallet", Icon: Wallet },
  { value: "banknote", label: "Banknote", Icon: Banknote },
  { value: "coins", label: "Coins", Icon: Coins },
];

export const ICON_MAP: Record<string, typeof PiggyBank> = Object.fromEntries(ICONS.map((i) => [i.value, i.Icon]));

const EMPTY_FORM = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  icon: "piggy-bank",
  productType: "OPEN_ENDED" as ProductType,
  minInvestmentNaira: "",
  tenorOptionsText: "",
  status: "DRAFT" as ProductStatus,
};

interface Props {
  open: boolean;
  tenantId: string;
  product?: Product | null;
  onClose: () => void;
}

const slugify = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const ProductFormDialog = ({ open, tenantId, product, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name,
        slug: product.slug,
        tagline: product.tagline ?? "",
        description: product.description ?? "",
        icon: product.icon,
        productType: product.productType,
        minInvestmentNaira: String(product.minInvestmentKobo / 100),
        tenorOptionsText: product.tenorOptions?.join(", ") ?? "",
        status: product.status,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [open, product]);

  const tenorOptions = form.tenorOptionsText
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        tagline: form.tagline || undefined,
        description: form.description || undefined,
        icon: form.icon,
        minInvestmentKobo: nairaToKobo(parseFloat(form.minInvestmentNaira) || 0),
        tenorOptions: form.productType === "FIXED_TENOR" && tenorOptions.length ? tenorOptions : undefined,
        status: form.status,
      };
      if (product) return updateProduct(product.id, payload);
      return createProduct({ tenantId, slug: form.slug || slugify(form.name), productType: form.productType, ...payload });
    },
    onSuccess: () => {
      toast.success(product ? "Product updated." : "Product created.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isValid = form.name.trim().length > 0 && form.minInvestmentNaira !== "" && parseFloat(form.minInvestmentNaira) >= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {product ? "Edit Product" : "New Investment Product"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input placeholder="e.g. GopherEdge" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Tagline</Label>
            <Input placeholder="Short one-liner shown on the card" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Description / Terms</Label>
            <Textarea
              placeholder="Full details members see before subscribing…"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICONS.map(({ value, label, Icon }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProductStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft (hidden from members)</SelectItem>
                  <SelectItem value="ACTIVE">Active (visible to members)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!product && (
            <div className="space-y-1.5">
              <Label>Product Type *</Label>
              <Select value={form.productType} onValueChange={(v) => setForm({ ...form, productType: v as ProductType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN_ENDED">Open-ended (amount only, no tenor)</SelectItem>
                  <SelectItem value="FIXED_TENOR">Fixed tenor (member picks a lock-up period)</SelectItem>
                  <SelectItem value="GOAL_BASED">Goal-based (target amount, Guided/Unguided)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Minimum Investment (₦) *</Label>
            <Input
              type="number" min={0} placeholder="e.g. 20000"
              value={form.minInvestmentNaira}
              onChange={(e) => setForm({ ...form, minInvestmentNaira: e.target.value })}
            />
          </div>

          {form.productType === "FIXED_TENOR" && (
            <div className="space-y-1.5">
              <Label>Tenor Options (months, comma-separated)</Label>
              <Input placeholder="e.g. 3, 6, 9, 12, 18, 24" value={form.tenorOptionsText} onChange={(e) => setForm({ ...form, tenorOptionsText: e.target.value })} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button disabled={!isValid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : product ? "Save Changes" : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormDialog;
