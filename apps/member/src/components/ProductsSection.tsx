import { useEffect, useState } from "react";
import { TrendingUp, PiggyBank, Wallet, Banknote, Coins, ChevronRight } from "lucide-react";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { fetchActiveProducts, fetchMemberSubscriptions, type Product, type ProductSubscription } from "@jollify/shared/lib/api/products";
import ProductDetailDialog from "./ProductDetailDialog";

const ICON_MAP: Record<string, typeof PiggyBank> = {
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  wallet: Wallet,
  banknote: Banknote,
  coins: Coins,
};

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  EXITED: "bg-gray-50 text-gray-600 border-gray-200",
};

interface Props {
  memberId: string;
  tenantId: string;
  memberName: string;
  memberEmail: string;
  cooperativeName: string;
}

const ProductsSection = ({ memberId, tenantId, memberName, memberEmail, cooperativeName }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, s] = await Promise.all([fetchActiveProducts(), fetchMemberSubscriptions(memberId)]);
    setProducts(p);
    setSubscriptions(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, [memberId]);

  const subscriptionFor = (productId: string) =>
    subscriptions.find((s) => s.productId === productId && s.status !== "EXITED" && s.status !== "REJECTED") ?? null;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground text-sm">Investment Products</h2>
      </div>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">No investment products available yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
          {products.map((p) => {
            const Icon = ICON_MAP[p.icon] ?? PiggyBank;
            const sub = subscriptionFor(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className="text-left rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-primary/4 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  {sub && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge[sub.status]}`}>
                      {sub.status === "ACTIVE" ? "Subscribed" : sub.status === "PENDING" ? "Pending" : sub.status}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground text-sm">{p.name}</h3>
                {p.tagline && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.tagline}</p>}
                <p className="text-xs text-muted-foreground mt-2">Min. {formatMoneyFull(p.minInvestmentKobo)}</p>
                {sub?.status === "ACTIVE" && (
                  <p className="text-sm font-bold text-foreground mt-1">{formatMoneyFull(sub.currentBalanceKobo)}</p>
                )}
                <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-3">
                  View more <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          memberId={memberId}
          tenantId={tenantId}
          memberName={memberName}
          memberEmail={memberEmail}
          cooperativeName={cooperativeName}
          subscription={subscriptionFor(selectedProduct.id)}
          onClose={() => setSelectedProduct(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};

export default ProductsSection;
