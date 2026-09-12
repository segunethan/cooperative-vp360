import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jollify/shared/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { Plus, TrendingUp, Pencil, Inbox } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllProducts,
  fetchPendingProductRequests,
  reviewSubscription,
  reviewSubscriptionRequest,
  notifyRequestReviewed,
  type Product,
} from "@jollify/shared/lib/api/products";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import ProductFormDialog, { ICON_MAP } from "@/components/cooperative/products/ProductFormDialog";
import PublishRateDialog from "@/components/cooperative/products/PublishRateDialog";

const requestKindLabel: Record<string, string> = {
  SUBSCRIPTION: "New Subscription",
  TOPUP: "Top-up",
  WITHDRAWAL: "Withdrawal",
};

const requestKindColor: Record<string, string> = {
  SUBSCRIPTION: "bg-blue-50 text-blue-700 border-blue-200",
  TOPUP: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WITHDRAWAL: "bg-amber-50 text-amber-700 border-amber-200",
};

const Products = () => {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [rateProduct, setRateProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: fetchAllProducts,
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["product-requests"],
    queryFn: fetchPendingProductRequests,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ req, approve }: { req: (typeof requests)[number]; approve: boolean }) => {
      if (req.kind === "SUBSCRIPTION") {
        await reviewSubscription(req.id, approve, user?.id ?? "");
      } else {
        await reviewSubscriptionRequest(req.id, approve, user?.id ?? "");
      }
      if (req.memberEmail) {
        await notifyRequestReviewed({
          memberEmail: req.memberEmail,
          memberName: req.memberName,
          cooperativeName: tenant?.name ?? "your cooperative",
          requestLabel: `${req.productName} ${requestKindLabel[req.kind].toLowerCase()}`,
          amountLabel: formatMoneyFull(req.amountKobo),
          status: approve ? "APPROVED" : "REJECTED",
        });
      }
    },
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Request approved." : "Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["product-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investment Products</h1>
          <p className="text-muted-foreground">Manage the product catalog, approve requests, and publish returns</p>
        </div>
        <Button size="sm" onClick={() => { setEditingProduct(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="catalog" className="space-y-4">
            <TabsList>
              <TabsTrigger value="catalog">Catalog</TabsTrigger>
              <TabsTrigger value="requests">
                Requests
                {requests.length > 0 && (
                  <span className="ml-2 bg-warning text-warning-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {requests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rates">Publish Rate</TabsTrigger>
            </TabsList>

            {/* ── Catalog ── */}
            <TabsContent value="catalog">
              {loadingProducts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium">No products yet</p>
                  <p className="text-sm">Create your first investment product to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((p) => {
                    const Icon = ICON_MAP[p.icon] ?? TrendingUp;
                    return (
                      <Card key={p.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <Badge variant="outline" className={p.status === "ACTIVE" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                              {p.status === "ACTIVE" ? "Active" : "Draft"}
                            </Badge>
                          </div>
                          <div>
                            <h4 className="font-semibold">{p.name}</h4>
                            {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Min. investment: <span className="font-medium text-foreground">{formatMoneyFull(p.minInvestmentKobo)}</span>
                          </p>
                          <Button variant="outline" size="sm" className="w-full" onClick={() => { setEditingProduct(p); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Requests ── */}
            <TabsContent value="requests">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRequests ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                      ))
                    ) : requests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                            <Inbox className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">No pending requests</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      requests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant="outline" className={requestKindColor[r.kind]}>{requestKindLabel[r.kind]}</Badge>
                          </TableCell>
                          <TableCell>{r.memberName}</TableCell>
                          <TableCell>{r.productName}</TableCell>
                          <TableCell className="text-right font-medium">{formatMoneyFull(r.amountKobo)}</TableCell>
                          <TableCell>{new Date(r.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm" className="text-success hover:text-success"
                                disabled={reviewMutation.isPending}
                                onClick={() => reviewMutation.mutate({ req: r, approve: true })}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                disabled={reviewMutation.isPending}
                                onClick={() => reviewMutation.mutate({ req: r, approve: false })}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Publish Rate ── */}
            <TabsContent value="rates">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.filter((p) => p.status === "ACTIVE").map((p) => {
                  const Icon = ICON_MAP[p.icon] ?? TrendingUp;
                  return (
                    <Card key={p.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.productType.replace("_", " ")}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setRateProduct(p)}>Publish Rate</Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {products.filter((p) => p.status === "ACTIVE").length === 0 && !loadingProducts && (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-10">
                    No active products yet — activate a product from the Catalog tab first.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ProductFormDialog
        open={formOpen}
        tenantId={tenant?.id ?? ""}
        product={editingProduct}
        onClose={() => { setFormOpen(false); setEditingProduct(null); }}
      />
      <PublishRateDialog product={rateProduct} onClose={() => setRateProduct(null)} />
    </div>
  );
};

export default Products;
