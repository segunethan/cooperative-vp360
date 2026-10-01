import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
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
  ArrowLeft,
  User,
  CreditCard,
  Landmark,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  AlertCircle,
  FileCheck,
  ListChecks,
  CircleAlert,
  Wallet,
  Pencil,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMemberProfile,
  fetchMemberContributionHistory,
  fetchMemberLoanHistory,
  updateMemberPayrollInfo,
  type MemberPayrollFormData,
  type MemberProfile as MemberProfileData,
} from "@jollify/shared/lib/api/members";
import { fetchPayrollSettings } from "@jollify/shared/lib/api/settings";
import { fetchOwnKyc } from "@jollify/shared/lib/api/kyc";
import { fetchMemberLedger, type MemberDueRow } from "@jollify/shared/lib/api/ledger";
import { formatMoneyFull } from "@jollify/shared/lib/money";
import { useToast } from "@jollify/shared/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import KycDetails from "@/components/cooperative/kyc/KycDetails";

const dueStatusColor = (s: string) =>
  s === "FULFILLED" ? "bg-success/10 text-success border-success/20"
  : s === "PARTIAL" ? "bg-warning/10 text-warning border-warning/20"
  : s === "WAIVED" ? "bg-muted/10 text-muted-foreground border-border"
  : "bg-destructive/10 text-destructive border-destructive/20"; // OPEN past its cycle = a gap

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MemberDuesLedger = ({ memberId }: { memberId: string }) => {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [dues, setDues] = useState<MemberDueRow[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["member-dues-ledger", memberId, cursor],
    queryFn: () => fetchMemberLedger(memberId, cursor),
    enabled: !!memberId,
  });

  // Keyset pagination returns one page per cursor — accumulate pages here so
  // "Load more" appends instead of replacing what's already on screen.
  useEffect(() => {
    if (!data) return;
    setDues((prev) => (cursor ? [...prev, ...data.dues] : data.dues));
  }, [data, cursor]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll & Dues Ledger</CardTitle>
        <p className="text-sm text-muted-foreground">
          Expected vs. actual per cycle, across every deduction method — a red "Open" badge on a past cycle is a gap.
        </p>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Fulfilled</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && dues.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : dues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                      <ListChecks className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No dues generated for this member yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                dues.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{MONTH_NAMES[d.period_month - 1]} {d.period_year}</TableCell>
                    <TableCell>{d.due_type === "CONTRIBUTION" ? "Contribution" : "Loan Installment"}</TableCell>
                    <TableCell className="capitalize">{d.deduction_method.toLowerCase().replace("_", " ")}</TableCell>
                    <TableCell>{formatMoneyFull(d.amount_due_kobo)}</TableCell>
                    <TableCell>{d.fulfilled_amount_kobo > 0 ? formatMoneyFull(d.fulfilled_amount_kobo) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={dueStatusColor(d.status)}>
                        {d.status === "OPEN" ? (
                          <span className="flex items-center gap-1"><CircleAlert className="h-3 w-3" />Open</span>
                        ) : d.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {data?.nextCursor && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline" size="sm"
              onClick={() => setCursor(data.nextCursor!)}
            >
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const statusColors: Record<string, string> = {
  Active:   "bg-success/10 text-success border-success/20",
  Pending:  "bg-warning/10 text-warning border-warning/20",
  Suspended:"bg-destructive/10 text-destructive border-destructive/20",
  Exited:   "bg-muted/10 text-muted-foreground border-border",
};

const contributionStatusColor = (s: string) =>
  s === "Completed" ? "bg-success/10 text-success border-success/20"
  : s === "Failed" ? "bg-destructive/10 text-destructive border-destructive/20"
  : "bg-warning/10 text-warning border-warning/20";

const loanStatusColor = (s: string) =>
  s === "Active" || s === "Repaid" ? "bg-success/10 text-success border-success/20"
  : s === "Rejected" || s === "Defaulted" ? "bg-destructive/10 text-destructive border-destructive/20"
  : "bg-warning/10 text-warning border-warning/20";

const SkeletonCard = () => (
  <Card><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
);

const deductionMethodLabel: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  PAYROLL: "Payroll",
};

const MemberPayrollCard = ({ memberNumber, profile }: { memberNumber: string; profile: MemberProfileData }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MemberPayrollFormData>({
    employerName: profile.employerName ?? "",
    staffId: profile.staffId ?? "",
    deductionMethod: profile.deductionMethod,
    recurringContributionNaira: profile.recurringContributionAmountKobo
      ? String(profile.recurringContributionAmountKobo / 100)
      : "",
  });

  const resetForm = () => setForm({
    employerName: profile.employerName ?? "",
    staffId: profile.staffId ?? "",
    deductionMethod: profile.deductionMethod,
    recurringContributionNaira: profile.recurringContributionAmountKobo
      ? String(profile.recurringContributionAmountKobo / 100)
      : "",
  });

  const mutation = useMutation({
    mutationFn: () => updateMemberPayrollInfo(memberNumber, form),
    onSuccess: () => {
      toast({ title: "Payroll information updated" });
      queryClient.invalidateQueries({ queryKey: ["member-profile", memberNumber] });
      setEditing(false);
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payroll & Deductions</CardTitle>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-employer">Employer</Label>
                <Input
                  id="pf-employer" placeholder="Company name"
                  value={form.employerName}
                  onChange={(e) => setForm((p) => ({ ...p, employerName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-staffid">Staff ID</Label>
                <Input
                  id="pf-staffid" placeholder="e.g. STF-0042"
                  value={form.staffId}
                  onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-method">Deduction Method</Label>
                <Select
                  value={form.deductionMethod}
                  onValueChange={(v) => setForm((p) => ({ ...p, deductionMethod: v as MemberPayrollFormData["deductionMethod"] }))}
                >
                  <SelectTrigger id="pf-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="PAYROLL">Payroll</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-amount">Recurring Contribution (₦)</Label>
                <Input
                  id="pf-amount" type="number" min={0} placeholder="e.g. 10000"
                  value={form.recurringContributionNaira}
                  onChange={(e) => setForm((p) => ({ ...p, recurringContributionNaira: e.target.value }))}
                />
              </div>
            </div>
            {form.deductionMethod === "PAYROLL" && (
              <p className="text-xs text-muted-foreground">
                Dues for this cycle will only be included in a payroll batch once "Generate Dues" has been run for that period on the Payroll page.
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => { resetForm(); setEditing(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Briefcase, label: "Employer", value: profile.employerName || "—" },
              { icon: User, label: "Staff ID", value: profile.staffId || "—" },
              { icon: Wallet, label: "Deduction Method", value: deductionMethodLabel[profile.deductionMethod] },
              {
                icon: CreditCard,
                label: "Recurring Contribution",
                value: profile.recurringContributionAmountKobo ? formatMoneyFull(profile.recurringContributionAmountKobo) : "—",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MemberProfile = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const memberNumber = memberId ?? "";

  const { data: profile, isLoading: loadingProfile, error: profileError } = useQuery({
    queryKey: ["member-profile", memberNumber],
    queryFn: () => fetchMemberProfile(memberNumber),
    enabled: !!memberNumber,
  });

  const { data: payrollSettings } = useQuery({
    queryKey: ["payroll-settings", tenant?.id],
    queryFn: () => fetchPayrollSettings(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: contributions = [], isLoading: loadingContribs } = useQuery({
    queryKey: ["member-contributions", memberNumber],
    queryFn: () => fetchMemberContributionHistory(memberNumber),
    enabled: !!memberNumber,
  });

  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ["member-loans", memberNumber],
    queryFn: () => fetchMemberLoanHistory(memberNumber),
    enabled: !!memberNumber,
  });

  const { data: kyc, isLoading: loadingKyc } = useQuery({
    queryKey: ["member-kyc", profile?.id],
    queryFn: () => fetchOwnKyc(profile!.id),
    enabled: !!profile?.id,
  });

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-medium">Member not found</p>
        <p className="text-sm text-muted-foreground">{memberNumber} does not exist in your cooperative.</p>
        <Button variant="outline" onClick={() => navigate("/cooperative/members")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Members
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back & Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cooperative/members")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {loadingProfile ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">{profile!.name}</h1>
              <p className="text-muted-foreground">{profile!.memberNumber} · Joined {profile!.joinDate}</p>
            </>
          )}
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusColors[profile.status] ?? ""}>
              {profile.status}
            </Badge>
            {profile.kycVerified && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <ShieldCheck className="h-3 w-3 mr-1" />
                KYC Verified
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingProfile ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div>
                <div>
                  <p className="text-xl font-bold text-foreground">{profile!.contributionTotal}</p>
                  <p className="text-xs text-muted-foreground">Total Contributions (completed)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10 text-warning"><Landmark className="h-5 w-5" /></div>
                <div>
                  <p className="text-xl font-bold text-foreground">{profile!.loanTotal}</p>
                  <p className="text-xs text-muted-foreground">Outstanding Loan Principal</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10 text-success"><User className="h-5 w-5" /></div>
                <div>
                  <p className="text-xl font-bold text-foreground">{contributions.length}</p>
                  <p className="text-xs text-muted-foreground">Total Contribution Transactions</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal"><User className="h-4 w-4 mr-1" />Personal Info</TabsTrigger>
          <TabsTrigger value="kyc"><FileCheck className="h-4 w-4 mr-1" />KYC & Onboarding</TabsTrigger>
          <TabsTrigger value="contributions"><CreditCard className="h-4 w-4 mr-1" />Contributions</TabsTrigger>
          <TabsTrigger value="loans"><Landmark className="h-4 w-4 mr-1" />Loans</TabsTrigger>
          <TabsTrigger value="dues-ledger"><ListChecks className="h-4 w-4 mr-1" />Payroll Ledger</TabsTrigger>
        </TabsList>

        {/* ── Personal Info ── */}
        <TabsContent value="personal">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent>
              {loadingProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { icon: Mail, label: "Email", value: profile!.email || "—" },
                    { icon: Phone, label: "Phone", value: profile!.phone || "—" },
                    { icon: User, label: "Gender", value: profile!.gender || "—" },
                    { icon: Calendar, label: "Date of Birth", value: profile!.dateOfBirth || "—" },
                    { icon: MapPin, label: "Address", value: profile!.address || "—" },
                    { icon: Briefcase, label: "Occupation", value: profile!.occupation || "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium text-foreground">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {payrollSettings?.payrollEnabled && profile && (
            <div className="mt-6">
              <MemberPayrollCard memberNumber={memberNumber} profile={profile} />
            </div>
          )}
        </TabsContent>

        {/* ── KYC & Onboarding ── */}
        <TabsContent value="kyc">
          <Card>
            <CardHeader><CardTitle>KYC & Onboarding</CardTitle></CardHeader>
            <CardContent>
              {loadingKyc ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !kyc ? (
                <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                  <FileCheck className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">This member has not submitted an onboarding form yet.</p>
                </div>
              ) : (
                <KycDetails submission={kyc} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contributions ── */}
        <TabsContent value="contributions">
          <Card>
            <CardHeader><CardTitle>Contribution History</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingContribs ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : contributions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                            <CreditCard className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No contributions recorded yet.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contributions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.date}</TableCell>
                          <TableCell className="font-medium">{c.amount}</TableCell>
                          <TableCell>{c.channel}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={contributionStatusColor(c.status)}>
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{c.reference}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Loans ── */}
        <TabsContent value="loans">
          <Card>
            <CardHeader><CardTitle>Loan History</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Disbursed</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLoans ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : loans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                            <Landmark className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No loans on record for this member.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      loans.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">{l.loanNumber}</TableCell>
                          <TableCell className="font-medium">{l.principalAmount}</TableCell>
                          <TableCell>{l.purpose}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={loanStatusColor(l.status)}>
                              {l.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{l.appliedDate}</TableCell>
                          <TableCell>{l.disbursedDate ?? "—"}</TableCell>
                          <TableCell>{l.dueDate ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dues-ledger">
          {profile?.id && <MemberDuesLedger memberId={profile.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MemberProfile;
