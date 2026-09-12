import { useEffect, useState } from "react";
import { X, PiggyBank, TrendingUp, Wallet, Banknote, Coins, History, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatMoneyFull, nairaToKobo } from "@jollify/shared/lib/money";
import {
  subscribeToProduct,
  requestSubscriptionChange,
  fetchSubscriptionLedger,
  fetchLatestRateUpdate,
  notifyRequestSubmitted,
  type Product,
  type ProductSubscription,
  type LedgerRow,
} from "@jollify/shared/lib/api/products";

const ICON_MAP: Record<string, typeof PiggyBank> = {
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  wallet: Wallet,
  banknote: Banknote,
  coins: Coins,
};

const entryLabel: Record<string, string> = {
  INITIAL: "Invested",
  RATE_APPLIED: "Rate Applied",
  TOPUP: "Top-up",
  WITHDRAWAL: "Withdrawal",
};

interface Props {
  product: Product;
  memberId: string;
  tenantId: string;
  memberName: string;
  memberEmail: string;
  cooperativeName: string;
  subscription: ProductSubscription | null;
  onClose: () => void;
  onChanged: () => void;
}

const ProductDetailDialog = ({ product, memberId, tenantId, memberName, memberEmail, cooperativeName, subscription, onClose, onChanged }: Props) => {
  const Icon = ICON_MAP[product.icon] ?? PiggyBank;

  const [amount, setAmount] = useState("");
  const [tenorMonths, setTenorMonths] = useState<string>(product.tenorOptions?.[0]?.toString() ?? "");
  const [variant, setVariant] = useState<"GUIDED" | "UNGUIDED">("UNGUIDED");
  const [targetAmount, setTargetAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMode, setActionMode] = useState<"none" | "topup" | "withdraw">("none");

  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [latestRate, setLatestRate] = useState<{ ratePercent: number; publishedAt: string } | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    if (subscription?.status !== "ACTIVE") return;
    setLoadingLedger(true);
    Promise.all([fetchSubscriptionLedger(subscription.id), fetchLatestRateUpdate(product.id)])
      .then(([l, r]) => { setLedger(l); setLatestRate(r); })
      .finally(() => setLoadingLedger(false));
  }, [subscription, product.id]);

  const handleSubscribe = async () => {
    setError(null);
    const naira = parseFloat(amount);
    if (!naira || naira <= 0) { setError("Enter a valid amount"); return; }
    if (naira * 100 < product.minInvestmentKobo) {
      setError(`Minimum investment for this product is ${formatMoneyFull(product.minInvestmentKobo)}`);
      return;
    }
    setSubmitting(true);
    try {
      await subscribeToProduct({
        tenantId, memberId, productId: product.id,
        principalKobo: nairaToKobo(naira),
        tenorMonths: product.productType === "FIXED_TENOR" ? parseInt(tenorMonths, 10) : undefined,
        variant: product.productType === "GOAL_BASED" ? variant : undefined,
        targetAmountKobo: product.productType === "GOAL_BASED" && targetAmount ? nairaToKobo(parseFloat(targetAmount)) : undefined,
      });
      await notifyRequestSubmitted({
        tenantId, memberName, cooperativeName,
        requestLabel: `${product.name} subscription`,
        amountLabel: formatMoneyFull(nairaToKobo(naira)),
      });
      onChanged();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChange = async (type: "TOPUP" | "WITHDRAWAL") => {
    if (!subscription) return;
    setError(null);
    const naira = parseFloat(amount);
    if (!naira || naira <= 0) { setError("Enter a valid amount"); return; }
    if (type === "WITHDRAWAL" && nairaToKobo(naira) > subscription.currentBalanceKobo) {
      setError("You can't withdraw more than your current balance");
      return;
    }
    setSubmitting(true);
    try {
      await requestSubscriptionChange({
        tenantId, subscriptionId: subscription.id, memberId,
        requestType: type, amountKobo: nairaToKobo(naira),
      });
      await notifyRequestSubmitted({
        tenantId, memberName, cooperativeName,
        requestLabel: `${product.name} ${type === "TOPUP" ? "top-up" : "withdrawal"}`,
        amountLabel: formatMoneyFull(nairaToKobo(naira)),
      });
      onChanged();
      setAmount("");
      setActionMode("none");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
              {product.tagline && <p className="text-xs text-muted-foreground truncate">{product.tagline}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
          )}

          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Minimum investment: <span className="font-semibold text-foreground">{formatMoneyFull(product.minInvestmentKobo)}</span>
            </p>
          </div>

          {/* ── Not yet subscribed: show subscribe form ── */}
          {!subscription && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Amount (₦) *</label>
                <input
                  type="number" min={product.minInvestmentKobo / 100} placeholder="e.g. 50000"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {product.productType === "FIXED_TENOR" && product.tenorOptions && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Lock-up Period *</label>
                  <select
                    value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {product.tenorOptions.map((m) => <option key={m} value={m}>{m} months</option>)}
                  </select>
                </div>
              )}

              {product.productType === "GOAL_BASED" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Target Amount (₦)</label>
                    <input
                      type="number" min={0} placeholder="e.g. 1000000"
                      value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Plan Type</label>
                    <select
                      value={variant} onChange={(e) => setVariant(e.target.value as "GUIDED" | "UNGUIDED")}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="UNGUIDED">Unguided — contribute anytime</option>
                      <option value="GUIDED">Guided — periodic reminders</option>
                    </select>
                  </div>
                </>
              )}

              <button
                onClick={handleSubscribe} disabled={submitting}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Subscribe"}
              </button>
            </div>
          )}

          {/* ── Pending approval ── */}
          {subscription?.status === "PENDING" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Your subscription request of {formatMoneyFull(subscription.principalKobo)} is pending admin approval.
            </div>
          )}

          {subscription?.status === "REJECTED" && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              Your subscription request was not approved. Contact your cooperative administrator for details.
            </div>
          )}

          {subscription?.status === "EXITED" && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
              This position has been fully withdrawn.
            </div>
          )}

          {/* ── Active position: portfolio + ledger + topup/withdraw ── */}
          {subscription?.status === "ACTIVE" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Principal Invested</p>
                  <p className="text-lg font-bold text-foreground">{formatMoneyFull(subscription.principalKobo)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="text-lg font-bold text-foreground">{formatMoneyFull(subscription.currentBalanceKobo)}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Invested on {subscription.investedAt ? new Date(subscription.investedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                {" · "}
                {latestRate
                  ? `Last rate: ${latestRate.ratePercent}% (${new Date(latestRate.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`
                  : "Interest not yet published"}
              </p>

              {/* Transaction history */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Transaction History</p>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">B/F</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingLedger ? (
                        <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Loading…</td></tr>
                      ) : ledger.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">No transactions yet.</td></tr>
                      ) : (
                        ledger.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{new Date(row.effectiveAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                            <td className="px-3 py-2">{entryLabel[row.entryType]}</td>
                            <td className="px-3 py-2 text-right">{formatMoneyFull(row.balanceBeforeKobo)}</td>
                            <td className={`px-3 py-2 text-right ${row.amountKobo < 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {row.amountKobo >= 0 ? "+" : ""}{formatMoneyFull(row.amountKobo)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{formatMoneyFull(row.balanceAfterKobo)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top-up / Withdraw */}
              {actionMode === "none" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionMode("topup")}
                    className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Top-up
                  </button>
                  <button
                    onClick={() => setActionMode("withdraw")}
                    className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5" /> Withdraw
                  </button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    {actionMode === "topup" ? "Request a top-up" : "Request a withdrawal"}
                  </p>
                  <input
                    type="number" min={1} placeholder="Amount (₦)"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setActionMode("none"); setAmount(""); setError(null); }}
                      className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRequestChange(actionMode === "topup" ? "TOPUP" : "WITHDRAWAL")}
                      disabled={submitting}
                      className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {submitting ? "Submitting…" : "Submit Request"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailDialog;
