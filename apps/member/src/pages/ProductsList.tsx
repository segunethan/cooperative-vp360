import { Link } from "react-router-dom";
import { TrendingUp, PiggyBank, Wallet, Banknote, Coins, ChevronRight } from "lucide-react";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { fetchActiveProducts, fetchMemberSubscriptions } from "@jollify/shared/lib/api/products";
import { useMemberProfile } from "@/hooks/useMemberProfile";
import { useQuery } from "@tanstack/react-query";

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

const ProductsList = () => {
  const { data: profile } = useMemberProfile();

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["active-products"],
    queryFn: fetchActiveProducts,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["member-subscriptions", profile?.memberId],
    queryFn: () => fetchMemberSubscriptions(profile!.memberId),
    enabled: !!profile,
  });

  const subscriptionFor = (productId: string) =>
    subscriptions.find((s) => s.productId === productId && s.status !== "EXITED" && s.status !== "REJECTED") ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Investment Products</h1>
        <p className="text-sm text-muted-foreground">Browse products, read the terms, and subscribe.</p>
      </div>

      {loadingProducts ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No investment products available yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((p) => {
            const Icon = ICON_MAP[p.icon] ?? PiggyBank;
            const sub = subscriptionFor(p.id);
            return (
              <Link
                key={p.id}
                to={`/member/products/${p.slug}`}
                className="rounded-xl border border-border p-4 bg-white hover:border-primary/40 hover:bg-primary/4 transition-colors"
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductsList;
