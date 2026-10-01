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
  Landmark,
  Banknote,
  Pencil,
  Archive,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingLoanApplications,
  fetchActiveLoans,
  approveLoanApplication,
  rejectLoanApplication,
  disburseLoanToMember,
  fetchPendingLoanTopups,
  reviewLoanTopup,
  fetchPendingLoanRepaymentRequests,
  reviewLoanRepaymentRequest,
} from "@jollify/shared/lib/api/loans";
import { fetchAllLoanTypes, archiveLoanType, type LoanType, type LoanPrepaymentStrategy } from "@jollify/shared/lib/api/loanTypes";
import { formatMoney, formatMoneyFull } from "@jollify/shared/lib/money";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import LoanApplicationDialog from "@/components/cooperative/loans/LoanApplicationDialog";
import LoanLedgerDialog from "@/components/cooperative/loans/LoanLedgerDialog";
import LoanScheduleDialog from "@/components/cooperative/loans/LoanScheduleDialog";
import TopupReviewDialog from "@/components/cooperative/loans/TopupReviewDialog";
import RecordRepaymentDialog from "@/components/cooperative/loans/RecordRepaymentDialog";
import LoanTypeFormDialog from "@/components/cooperative/loans/LoanTypeFormDialog";

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
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [newLoanOpen, setNewLoanOpen] = useState(false);
  const [ledgerLoan, setLedgerLoan] = useState<{ id: string; loanNumber: string; allowRepayment: boolean } | null>(null);
  const [scheduleLoan, setScheduleLoan] = useState<{ id: string; loanNumber: string } | null>(null);
  const [topupToReview, setTopupToReview] = useState<{ id: string; loanNumber: string; amountKobo: number; defaultStrategy: LoanPrepaymentStrategy } | null>(null);
  const [repaymentLoan, setRepaymentLoan] = useState<{ id: string; loanNumber: string } | null>(null);
  const [loanTypeDialogOpen, setLoanTypeDialogOpen] = useState(false);
  const [editingLoanType, setEditingLoanType] = useState<LoanType | null>(null);

  const { data: loanTypes = [], isLoading: loadingLoanTypes } = useQuery({
    queryKey: ["loan-types"],
    queryFn: fetchAllLoanTypes,
  });

  const archiveLoanTypeMutation = useMutation({
    mutationFn: (id: string) => archiveLoanType(id),
    onSuccess: () => {
      toast.success("Loan type archived.");
      queryClient.invalidateQueries({ queryKey: ["loan-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: applications = [], isLoading: loadingApplications } = useQuery({
    queryKey: ["loan-applications"],
    queryFn: fetchPendingLoanApplications,
  });

  const { data: activeLoans = [], isLoading: loadingActive } = useQuery({
    queryKey: ["active-loans"],
    queryFn: fetchActiveLoans,
  });

  const { data: topupRequests = [], isLoading: loadingTopups } = useQuery({
    queryKey: ["loan-topup-requests"],
    queryFn: fetchPendingLoanTopups,
  });

  const { data: repaymentRequests = [], isLoading: loadingRepaymentRequests } = useQuery({
    queryKey: ["loan-repayment-requests"],
    queryFn: fetchPendingLoanRepaymentRequests,
  });

  const invalidateLoans = () => {
    queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
    queryClient.invalidateQueries({ queryKey: ["active-loans"] });
  };

  const topupMutation = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      reviewLoanTopup(requestId, approve, user?.id ?? ""),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Top-up approved." : "Top-up rejected.");
      queryClient.invalidateQueries({ queryKey: ["loan-topup-requests"] });
      queryClient.invalidateQueries({ queryKey: ["loan-ledger"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const repaymentRequestMutation = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      reviewLoanRepaymentRequest(requestId, approve, user?.id ?? ""),
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "Repayment approved and posted." : "Repayment request rejected.");
      queryClient.invalidateQueries({ queryKey: ["loan-repayment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-ledger"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const disburseMutation = useMutation({
    mutationFn: ({ loanId }: { loanId: string }) => disburseLoanToMember(loanId),
    onSuccess: () => {
      toast.success("Loan disbursed — it's now active and will appear under Active Loans.");
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
              <TabsTrigger value="topups">
                Top-up Requests
                {topupRequests.length > 0 && (
                  <span className="ml-2 bg-warning text-warning-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {topupRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="repayment-requests">
                Repayment Requests
                {repaymentRequests.length > 0 && (
                  <span className="ml-2 bg-warning text-warning-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {repaymentRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="loan-types">Loan Types</TabsTrigger>
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
                        <TableHead>Loan Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingApplications ? (
                        Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                      ) : applications.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
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
                            <TableCell className="text-sm">{app.loanTypeName}</TableCell>
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
                                {app.status === "Approved" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-success hover:text-success"
                                    disabled={disburseMutation.isPending}
                                    onClick={() => disburseMutation.mutate({ loanId: app.id })}
                                  >
                                    Disburse
                                  </Button>
                                )}
                                {app.status !== "Pending Review" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setLedgerLoan({ id: app.id, loanNumber: app.loanNumber, allowRepayment: false })}
                                  >
                                    View
                                  </Button>
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
                        <TableHead>Repaid</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Disbursed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingActive ? (
                        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                      ) : activeLoans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10}>
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
                            <TableCell className="text-success">{formatMoneyFull(loan.repaidKobo)}</TableCell>
                            <TableCell className="font-medium">{formatMoneyFull(loan.outstandingKobo)}</TableCell>
                            <TableCell>{loan.dueDate}</TableCell>
                            <TableCell>{loan.disbursedDate}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setScheduleLoan({ id: loan.id, loanNumber: loan.loanNumber })}
                                >
                                  Schedule
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLedgerLoan({ id: loan.id, loanNumber: loan.loanNumber, allowRepayment: true })}
                                >
                                  History
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary"
                                  onClick={() => setRepaymentLoan({ id: loan.id, loanNumber: loan.loanNumber })}
                                >
                                  Record Repayment
                                </Button>
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

            {/* ── Top-up Requests Tab ── */}
            <TabsContent value="topups">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Loan Top-up Requests</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingTopups ? (
                        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : topupRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                              <Banknote className="h-10 w-10 mb-3 opacity-30" />
                              <p className="font-medium">No pending top-up requests</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        topupRequests.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{r.loanNumber}</TableCell>
                            <TableCell>{r.memberName}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoneyFull(r.amountKobo)}</TableCell>
                            <TableCell>{new Date(r.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost" size="sm" className="text-success hover:text-success"
                                  onClick={() => setTopupToReview(r)}
                                >
                                  Review & Approve
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                  disabled={topupMutation.isPending}
                                  onClick={() => topupMutation.mutate({ requestId: r.id, approve: false })}
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
              </div>
            </TabsContent>

            {/* ── Repayment Requests Tab ── */}
            <TabsContent value="repayment-requests">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Member-Submitted Repayments</h3>
                  <p className="text-sm text-muted-foreground">
                    Members reporting a repayment they made — approving posts it to the loan ledger immediately.
                  </p>
                </div>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Date Paid</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingRepaymentRequests ? (
                        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                      ) : repaymentRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                              <Banknote className="h-10 w-10 mb-3 opacity-30" />
                              <p className="font-medium">No pending repayment requests</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        repaymentRequests.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{r.loanNumber}</TableCell>
                            <TableCell>{r.memberName}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoneyFull(r.amountKobo)}</TableCell>
                            <TableCell className="capitalize">{r.channel.replace("_", " ")}</TableCell>
                            <TableCell>{new Date(r.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost" size="sm" className="text-success hover:text-success"
                                  disabled={repaymentRequestMutation.isPending}
                                  onClick={() => repaymentRequestMutation.mutate({ requestId: r.id, approve: true })}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                  disabled={repaymentRequestMutation.isPending}
                                  onClick={() => repaymentRequestMutation.mutate({ requestId: r.id, approve: false })}
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
              </div>
            </TabsContent>

            {/* ── Loan Types Tab ── */}
            <TabsContent value="loan-types">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Loan Types</h3>
                    <p className="text-sm text-muted-foreground">
                      Members can only apply for the loan types configured here — name, interest rate and tenure are fixed per type.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => { setEditingLoanType(null); setLoanTypeDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Loan Type
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Interest Rate</TableHead>
                        <TableHead>Tenure</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingLoanTypes ? (
                        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : loanTypes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                              <Landmark className="h-10 w-10 mb-3 opacity-30" />
                              <p className="font-medium">No loan types configured yet</p>
                              <p className="text-sm">e.g. Fixed Term Loan, Loan Against Contribution, Emergency Loan.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        loanTypes.map((lt) => (
                          <TableRow key={lt.id}>
                            <TableCell>
                              <p className="font-medium">{lt.name}</p>
                              {lt.description && <p className="text-xs text-muted-foreground line-clamp-1">{lt.description}</p>}
                            </TableCell>
                            <TableCell>{lt.interestRatePercent}% p.a.</TableCell>
                            <TableCell>{lt.tenureMonths} months</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={lt.status === "ACTIVE" ? "bg-success/10 text-success border-success/20" : "bg-muted/10 text-muted-foreground border-border"}>
                                {lt.status === "ACTIVE" ? "Active" : "Archived"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingLoanType(lt); setLoanTypeDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {lt.status === "ACTIVE" && (
                                <Button
                                  variant="ghost" size="sm" className="text-muted-foreground"
                                  disabled={archiveLoanTypeMutation.isPending}
                                  onClick={() => archiveLoanTypeMutation.mutate(lt.id)}
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <TopupReviewDialog
        request={topupToReview}
        reviewerId={user?.id ?? ""}
        onClose={() => setTopupToReview(null)}
      />
      <LoanTypeFormDialog
        open={loanTypeDialogOpen}
        tenantId={tenant?.id ?? ""}
        loanType={editingLoanType}
        onClose={() => setLoanTypeDialogOpen(false)}
      />
      <LoanApplicationDialog
        open={newLoanOpen}
        onClose={() => setNewLoanOpen(false)}
        onSubmitted={invalidateLoans}
      />
      <LoanScheduleDialog
        loanId={scheduleLoan?.id ?? null}
        loanNumber={scheduleLoan?.loanNumber ?? ""}
        onClose={() => setScheduleLoan(null)}
      />
      <LoanLedgerDialog
        loanId={ledgerLoan?.id ?? null}
        loanNumber={ledgerLoan?.loanNumber ?? ""}
        onClose={() => setLedgerLoan(null)}
        onRecordRepayment={
          ledgerLoan?.allowRepayment
            ? () => {
                setRepaymentLoan({ id: ledgerLoan.id, loanNumber: ledgerLoan.loanNumber });
                setLedgerLoan(null);
              }
            : undefined
        }
      />
      <RecordRepaymentDialog
        loanId={repaymentLoan?.id ?? null}
        loanNumber={repaymentLoan?.loanNumber ?? ""}
        onClose={() => setRepaymentLoan(null)}
      />
    </div>
  );
};

export default Loans;
