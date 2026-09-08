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
import {
  CreditCard,
  TrendingDown,
  AlertTriangle,
  Plus,
  Download,
  Settings,
  Landmark,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingLoanApplications,
  fetchActiveLoans,
  approveLoanApplication,
  rejectLoanApplication,
} from "@jollify/shared/lib/api/loans";
import { formatMoney } from "@jollify/shared/lib/money";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import LoanApplicationDialog from "@/components/cooperative/loans/LoanApplicationDialog";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Approved":
    case "Active":
      return "bg-success/10 text-success border-success/20";
    case "Pending Review":
    case "Under Review":
      return "bg-warning/10 text-warning border-warning/20";
    case "Rejected":
    case "Defaulted":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted/10 text-muted-foreground border-border";
  }
};

const SkeletonRow = ({ cols }: { cols: number }) => (
  <TableRow>
    {Array.from({ length: cols }).map((_, i) => (
      <TableCell key={i}><Skeleton className="h-4 w-full" /></TableCell>
    ))}
  </TableRow>
);

const Loans = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newLoanOpen, setNewLoanOpen] = useState(false);

  const { data: applications = [], isLoading: loadingApplications } = useQuery({
    queryKey: ["loan-applications"],
    queryFn: fetchPendingLoanApplications,
  });

  const { data: activeLoans = [], isLoading: loadingActive } = useQuery({
    queryKey: ["active-loans"],
    queryFn: fetchActiveLoans,
  });

  const invalidateLoans = () => {
    queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
    queryClient.invalidateQueries({ queryKey: ["active-loans"] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ loanId }: { loanId: string }) =>
      approveLoanApplication(loanId, user?.id ?? ""),
    onSuccess: () => {
      toast.success("Loan application approved.");
      invalidateLoans();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ loanId }: { loanId: string }) => rejectLoanApplication(loanId),
    onSuccess: () => {
      toast.success("Loan application rejected.");
      invalidateLoans();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Derived stats from real data
  const totalPortfolioKobo = activeLoans.reduce((s, l) => s + l.principalKobo, 0);
  const pendingCount = applications.filter((a) => a.status === "Pending Review").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Loans Management</h1>
          <p className="text-muted-foreground">Manage loan applications and active portfolio</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Loan Products
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Portfolio Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Portfolio</p>
                {loadingActive ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{formatMoney(totalPortfolioKobo)}</p>
                )}
                <p className="text-xs text-muted-foreground">{activeLoans.length} active loans</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Applications</p>
                {loadingApplications ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{pendingCount}</p>
                )}
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                {loadingApplications ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{applications.length}</p>
                )}
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loans Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="applications" className="space-y-4">
            <TabsList>
              <TabsTrigger value="applications">
                Applications
                {pendingCount > 0 && (
                  <span className="ml-2 bg-warning text-warning-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="active">Active Loans</TabsTrigger>
              <TabsTrigger value="products">Loan Products</TabsTrigger>
            </TabsList>

            {/* ── Applications Tab ── */}
            <TabsContent value="applications">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Loan Applications</h3>
                  <Button size="sm" onClick={() => setNewLoanOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Application
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application ID</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingApplications ? (
                        Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                      ) : applications.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                              <Landmark className="h-10 w-10 mb-3 opacity-30" />
                              <p className="font-medium">No loan applications yet</p>
                              <p className="text-sm">Applications submitted by members will appear here.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        applications.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell className="font-medium font-mono text-sm">{app.loanNumber}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{app.member}</p>
                                <p className="text-sm text-muted-foreground">{app.memberNumber}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{app.principalAmount}</TableCell>
                            <TableCell>{app.purpose || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(app.status)}>
                                {app.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{app.appliedDate}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                {app.status === "Pending Review" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-success hover:text-success"
                                      disabled={approveMutation.isPending}
                                      onClick={() => approveMutation.mutate({ loanId: app.id })}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      disabled={rejectMutation.isPending}
                                      onClick={() => rejectMutation.mutate({ loanId: app.id })}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {app.status !== "Pending Review" && (
                                  <Button variant="ghost" size="sm">View</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ── Active Loans Tab ── */}
            <TabsContent value="active">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Active Loans</h3>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan ID</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Tenure</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Disbursed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingActive ? (
                        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                      ) : activeLoans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                              <CreditCard className="h-10 w-10 mb-3 opacity-30" />
                              <p className="font-medium">No active loans</p>
                              <p className="text-sm">Approved and disbursed loans will appear here.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        activeLoans.map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-medium font-mono text-sm">{loan.loanNumber}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{loan.member}</p>
                                <p className="text-sm text-muted-foreground">{loan.memberNumber}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{loan.principalAmount}</TableCell>
                            <TableCell>{loan.interestRatePercent}%</TableCell>
                            <TableCell>{loan.tenureMonths}mo</TableCell>
                            <TableCell>{loan.dueDate}</TableCell>
                            <TableCell>{loan.disbursedDate}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">View</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ── Loan Products Tab (static for now) ── */}
            <TabsContent value="products">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Loan Products</h3>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "Personal Loan", rate: "12%", max: "₦1,000,000", term: "24 months", fee: "2%" },
                    { name: "Emergency Loan", rate: "8%", max: "₦500,000", term: "12 months", fee: "1%" },
                    { name: "Business Loan", rate: "15%", max: "₦2,000,000", term: "36 months", fee: "3%" },
                  ].map((product) => (
                    <Card key={product.name}>
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-2">{product.name}</h4>
                        <div className="space-y-2 text-sm">
                          <p><span className="text-muted-foreground">Interest Rate:</span> {product.rate} per annum</p>
                          <p><span className="text-muted-foreground">Max Amount:</span> {product.max}</p>
                          <p><span className="text-muted-foreground">Max Term:</span> {product.term}</p>
                          <p><span className="text-muted-foreground">Processing Fee:</span> {product.fee}</p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-3">Configure</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <LoanApplicationDialog
        open={newLoanOpen}
        onClose={() => setNewLoanOpen(false)}
        onSubmitted={invalidateLoans}
      />
    </div>
  );
};

export default Loans;
