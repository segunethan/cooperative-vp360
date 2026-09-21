import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, PiggyBank, TrendingUp, Wallet, Banknote, Coins, History, ArrowUpCircle, ArrowDownCircle, ShieldAlert } from "lucide-react";
import { formatMoneyFull, nairaToKobo, generatePaymentReference } from "@jollify/shared/lib/money";
import { supabase } from "@jollify/shared/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchProductBySlug,
  fetchMemberSubscriptions,
  fetchSubscriptionLedger,
  fetchLatestRateUpdate,
  fetchAvailableContributionBalance,
  subscribeToProduct,
  requestSubscriptionChange,
  notifyRequestSubmitted,
  type FundingSource,
} from "@jollify/shared/lib/api/products";
import { useMemberProfile } from "@/hooks/useMemberProfile";
import { useKycGate } from "@/hooks/useKycGate";

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

const uploadReceipt = async (tenantId: string, file: File): Promise<string | null> => {
  const ext = file.name.split(".").pop() ?? "bin";
  const ref = generatePaymentReference("PRODREC");
  const path = `${tenantId}/${ref}.${ext}`;
  const { data, error } = await supabase.storage.from("contribution-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from("contribution-receipts").getPublicUrl(data.path);
  return urlData.publicUrl;
};

type Mode = "none" | "subscribe" | "topup" | "withdraw";

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMemberProfile();
  const { requireKyc } = useKycGate();

  const [mode, setMode] = useState<Mode>("none");
  const [amount, setAmount] = useState("");
  const [fundingSource, setFundingSource] = useState<FundingSource>("EXTERNAL_PAYMENT");
  const [channel, setChannel] = useState("bank_transfer");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [tenorMonths, setTenorMonths] = useState<string>("");
  const [variant, setVariant] = useState<"GUIDED" | "UNGUIDED">("UNGUIDED");
  const [targetAmount, setTargetAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug!),
    enabled: !!slug,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["member-subscriptions", profile?.memberId],
    queryFn: () => fetchMemberSubscriptions(profile!.memberId),
    enabled: !!profile,
  });

  const subscription = product ? subscriptions.find((s) => s.productId === product.id && s.status !== "EXITED" && s.status !== "REJECTED") ?? null : null;

  const { data: ledger = [], isLoading: loadingLedger } = useQuery({
    queryKey: ["subscription-ledger", subscription?.id],
    queryFn: () => fetchSubscriptionLedger(subscription!.id),
    enabled: subscription?.status === "ACTIVE",
  });

  const { data: latestRate } = useQuery({
    queryKey: ["product-latest-rate", product?.id],
    queryFn: () => fetchLatestRateUpdate(product!.id),
    enabled: subscription?.status === "ACTIVE",
  });

  const { data: availableBalance = 0 } = useQuery({
    queryKey: ["available-contribution-balance", profile?.memberId],
    queryFn: () => fetchAvailableContributionBalance(profile!.memberId),
    enabled: !!profile && (mode === "subscribe" || mode === "topup"),
  });

  const resetForm = () => {
    setMode("none");
    setAmount("");
    setFundingSource("EXTERNAL_PAYMENT");
    setReceiptFile(null);
    setError(null);
  };

  const refreshAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["member-subscriptions", profile?.memberId] });
    queryClient.invalidateQueries({ queryKey: ["subscription-ledger"] });
    queryClient.invalidateQueries({ queryKey: ["available-contribution-balance", profile?.memberId] });
  };

  const validateFunding = (naira: number): boolean => {
    if (fundingSource === "EXTERNAL_PAYMENT" && !receiptFile) {
      setError("Upload a receipt or proof of payment to continue.");
      return false;
    }
    if (fundingSource === "CONTRIBUTION_TRANSFER" && nairaToKobo(naira) > availableBalance) {
      setError(`You only have ${formatMoneyFull(availableBalance)} available in your contributions balance.`);
      return false;
    }
    return true;
  };

  const handleSubscribe = async () => {
    if (!profile || !product) return;
    setError(null);
    const naira = parseFloat(amount);
    if (!naira || naira <= 0) { setError("Enter a valid amount"); return; }
    if (naira * 100 < product.minInvestmentKobo) { setError(`Minimum investment is ${formatMoneyFull(product.minInvestmentKobo)}`); return; }
    if (!validateFunding(naira)) return;

    setSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (fundingSource === "EXTERNAL_PAYMENT" && receiptFile) {
        receiptUrl = (await uploadReceipt(profile.tenantId, receiptFile)) ?? undefined;
        if (!receiptUrl) { setError("Receipt upload failed. Please try again."); setSubmitting(false); return; }
      }
      await subscribeToProduct({
        tenantId: profile.tenantId, memberId: profile.memberId, productId: product.id,
        principalKobo: nairaToKobo(naira),
        tenorMonths: product.productType === "FIXED_TENOR" ? parseInt(tenorMonths, 10) : undefined,
        variant: product.productType === "GOAL_BASED" ? variant : undefined,
        targetAmountKobo: product.productType === "GOAL_BASED" && targetAmount ? nairaToKobo(parseFloat(targetAmount)) : undefined,
        fundingSource,
        receiptUrl,
      });
      await notifyRequestSubmitted({
        tenantId: profile.tenantId, memberName: profile.fullName, cooperativeName: profile.cooperativeName,
        requestLabel: `${product.name} subscription`, amountLabel: formatMoneyFull(nairaToKobo(naira)),
      });
      refreshAfterChange();
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopupOrWithdraw = async (type: "TOPUP" | "WITHDRAWAL") => {
    if (!profile || !subscription) return;
    setError(null);
    const naira = parseFloat(amount);
    if (!naira || naira <= 0) { setError("Enter a valid amount"); return; }

    if (type === "WITHDRAWAL") {
      if (!profile.kycVerified) { setError("Complete your KYC before requesting a withdrawal."); return; }
      if (nairaToKobo(naira) > subscription.currentBalanceKobo) { setError("You can't withdraw more than your current balance"); return; }
    } else {
      if (!validateFunding(naira)) return;
    }

    setSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (type === "TOPUP" && fundingSource === "EXTERNAL_PAYMENT" && receiptFile) {
        receiptUrl = (await uploadReceipt(profile.tenantId, receiptFile)) ?? undefined;
        if (!receiptUrl) { setError("Receipt upload failed. Please try again."); setSubmitting(false); return; }
      }
      await requestSubscriptionChange({
        tenantId: profile.tenantId, subscriptionId: subscription.id, memberId: profile.memberId,
        requestType: type, amountKobo: nairaToKobo(naira),
        fundingSource: type === "TOPUP" ? fundingSource : undefined,
        receiptUrl,
      });
      await notifyRequestSubmitted({
        tenantId: profile.tenantId, memberName: profile.fullName, cooperativeName: profile.cooperativeName,
        requestLabel: `${product?.name} ${type === "TOPUP" ? "top-up" : "withdrawal"}`, amountLabel: formatMoneyFull(nairaToKobo(naira)),
      });
      refreshAfterChange();
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct || !product) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const Icon = ICON_MAP[product.icon] ?? PiggyBank;

  const FundingChoice = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">How are you funding this? *</label>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => setFundingSource("EXTERNAL_PAYMENT")}
          className={`text-left rounded-lg border p-3 transition-colors ${fundingSource === "EXTERNAL_PAYMENT" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <p className="text-sm font-medium text-foreground">I've paid externally</p>
          <p className="text-xs text-muted-foreground">Bank transfer or cash — upload proof of payment.</p>
        </button>
        <button
          type="button"
          onClick={() => setFundingSource("CONTRIBUTION_TRANSFER")}
          className={`text-left rounded-lg border p-3 transition-colors ${fundingSource === "CONTRIBUTION_TRANSFER" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <p className="text-sm font-medium text-foreground">Move from my contributions</p>
          <p className="text-xs text-muted-foreground">Available: {formatMoneyFull(availableBalance)}</p>
        </button>
      </div>

      {fundingSource === "EXTERNAL_PAYMENT" && (
        <div className="space-y-3 pt-1">
          {product.creditAccountInfo ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">Account to Credit</p>
              <p className="text-sm text-emerald-800 whitespace-pre-line">{product.creditAccountInfo}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              No payment account has been set up for this product yet. Contact your cooperative admin before paying.
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Payment Channel</label>
            <select
              value={channel} onChange={(e) => setChannel(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash Deposit</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Date Paid</label>
            <input
              type="date" max={new Date().toISOString().split("T")[0]} value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Receipt / Proof of Payment *</label>
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/4 transition-colors">
              {receiptFile ? (
                <span className="text-xs font-medium text-foreground px-4 text-center">{receiptFile.name}</span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">Upload receipt, teller slip, or screenshot</span>
              )}
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/member/products")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{product.name}</h1>
          {product.tagline && <p className="text-sm text-muted-foreground">{product.tagline}</p>}
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}

      {product.description && (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-white rounded-xl border border-border p-4">{product.description}</p>
      )}

      <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm">
        <p className="text-muted-foreground">Minimum investment: <span className="font-semibold text-foreground">{formatMoneyFull(product.minInvestmentKobo)}</span></p>
      </div>

      {/* No subscription: subscribe */}
      {!subscription && (
        mode === "subscribe" ? (
          <div className="space-y-3 bg-white rounded-xl border border-border p-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Amount (₦) *</label>
              <input
                type="number" min={product.minInvestmentKobo / 100} placeholder="e.g. 50000"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {product.productType === "FIXED_TENOR" && product.tenorOptions && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Lock-up Period *</label>
                <select value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm">
                  <option value="">Select tenor</option>
                  {product.tenorOptions.map((m) => <option key={m} value={m}>{m} months</option>)}
                </select>
              </div>
            )}
            {product.productType === "GOAL_BASED" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Target Amount (₦)</label>
                  <input type="number" min={0} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Plan Type</label>
                  <select value={variant} onChange={(e) => setVariant(e.target.value as "GUIDED" | "UNGUIDED")} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm">
                    <option value="UNGUIDED">Unguided — contribute anytime</option>
                    <option value="GUIDED">Guided — periodic reminders</option>
                  </select>
                </div>
              </>
            )}
            <FundingChoice />
            <div className="flex gap-2 pt-1">
              <button onClick={resetForm} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={handleSubscribe} disabled={submitting} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {submitting ? "Submitting…" : "Subscribe"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => requireKyc() && setMode("subscribe")} className="w-full h-12 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Subscribe
          </button>
        )
      )}

      {subscription?.status === "PENDING" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Your subscription request of {formatMoneyFull(subscription.principalKobo)} is pending admin approval.
        </div>
      )}

      {subscription?.status === "REJECTED" && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          Your subscription request was not approved. Contact your cooperative administrator.
        </div>
      )}

      {/* Active: portfolio, ledger, actions */}
      {subscription?.status === "ACTIVE" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 bg-white">
              <p className="text-xs text-muted-foreground">Principal Invested</p>
              <p className="text-lg font-bold text-foreground">{formatMoneyFull(subscription.principalKobo)}</p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-white">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-lg font-bold text-foreground">{formatMoneyFull(subscription.currentBalanceKobo)}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Invested {subscription.investedAt ? new Date(subscription.investedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            {" · "}
            {latestRate ? `Last rate: ${latestRate.ratePercent}% (${new Date(latestRate.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : "Interest not yet published"}
          </p>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Transaction History</p>
            </div>
            <div className="border rounded-lg overflow-x-auto bg-white">
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
                        <td className={`px-3 py-2 text-right ${row.amountKobo < 0 ? "text-red-600" : "text-emerald-600"}`}>{row.amountKobo >= 0 ? "+" : ""}{formatMoneyFull(row.amountKobo)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatMoneyFull(row.balanceAfterKobo)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {mode === "none" && (
            <div className="flex gap-2">
              <button onClick={() => requireKyc() && setMode("topup")} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                <ArrowUpCircle className="h-3.5 w-3.5" /> Top-up
              </button>
              <button onClick={() => requireKyc() && setMode("withdraw")} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                <ArrowDownCircle className="h-3.5 w-3.5" /> Withdraw
              </button>
            </div>
          )}

          {mode === "topup" && (
            <div className="space-y-3 bg-white rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground">Request a top-up</p>
              <input
                type="number" min={1} placeholder="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <FundingChoice />
              <div className="flex gap-2">
                <button onClick={resetForm} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
                <button onClick={() => handleTopupOrWithdraw("TOPUP")} disabled={submitting} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </div>
          )}

          {mode === "withdraw" && (
            !profile?.kycVerified ? (
              <div className="space-y-3 bg-white rounded-xl border border-amber-200 p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <ShieldAlert className="h-4 w-4" />
                  <p className="text-sm font-semibold">Complete your KYC to withdraw</p>
                </div>
                <p className="text-xs text-muted-foreground">We need your bank details on file before processing any withdrawal.</p>
                <Link to="/member/kyc" className="block text-center h-11 leading-[44px] rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Complete KYC
                </Link>
                <button onClick={resetForm} className="w-full h-9 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            ) : (
              <div className="space-y-3 bg-white rounded-xl border border-border p-4">
                <p className="text-sm font-medium text-foreground">Request a withdrawal</p>
                <p className="text-xs text-muted-foreground">Funds will be sent to the bank account on your approved KYC.</p>
                <input
                  type="number" min={1} max={subscription.currentBalanceKobo / 100} placeholder="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <div className="flex gap-2">
                  <button onClick={resetForm} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
                  <button onClick={() => handleTopupOrWithdraw("WITHDRAWAL")} disabled={submitting} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                    {submitting ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {subscription?.status === "EXITED" && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">This position has been fully withdrawn.</div>
      )}
    </div>
  );
};

export default ProductDetail;
