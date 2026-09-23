import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jollify/shared/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@jollify/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { UserPlus, Inbox, Clock, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingApplications,
  fetchRejectedApplications,
  approveApplication,
  rejectApplication,
  type MemberApplication,
} from "@jollify/shared/lib/api/applications";
import { sendMemberInviteEmail } from "@jollify/shared/lib/api/members";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import MembershipLinkCard from "@/components/cooperative/members/MembershipLinkCard";
import { useKybGate } from "@/hooks/useKybGate";

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const Applications = () => {
  const { user, tenant } = useAuth();
  const { requireKyb } = useKybGate();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<MemberApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["pending-applications"],
    queryFn: fetchPendingApplications,
  });

  const { data: rejectedApplications = [], isLoading: loadingRejected } = useQuery({
    queryKey: ["rejected-applications"],
    queryFn: fetchRejectedApplications,
  });

  const approveMutation = useMutation({
    mutationFn: async (application: MemberApplication) => {
      const member = await approveApplication(tenant?.id ?? "", application, user?.id ?? "");
      await sendMemberInviteEmail(member.memberNumber, member.fullName, member.email, tenant?.name ?? "your cooperative", tenant?.cooperative_number);
    },
    onSuccess: () => {
      toast.success("Application approved — invite email sent.");
      queryClient.invalidateQueries({ queryKey: ["pending-applications"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectApplication(rejecting!.id, user?.id ?? "", rejectionReason || undefined),
    onSuccess: () => {
      toast.success("Application rejected.");
      queryClient.invalidateQueries({ queryKey: ["pending-applications"] });
      queryClient.invalidateQueries({ queryKey: ["rejected-applications"] });
      setRejecting(null);
      setRejectionReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Applications
        </h1>
        <p className="text-muted-foreground">Prospective members who applied through your public application link.</p>
      </div>

      <MembershipLinkCard />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending"><Clock className="h-4 w-4 mr-1" />Pending ({applications.length})</TabsTrigger>
          <TabsTrigger value="rejected"><XCircle className="h-4 w-4 mr-1" />Rejected ({rejectedApplications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Occupation</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                      ))
                    ) : applications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          <Inbox className="h-10 w-10 mb-3 mx-auto opacity-30" />
                          No pending applications.
                        </TableCell>
                      </TableRow>
                    ) : (
                      applications.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.firstName} {a.lastName}</TableCell>
                          <TableCell>{a.email}</TableCell>
                          <TableCell>{a.phone}</TableCell>
                          <TableCell>{a.occupation ?? "—"}</TableCell>
                          <TableCell>{fmtDate(a.submittedAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm" className="text-success hover:text-success"
                                disabled={approveMutation.isPending}
                                onClick={() => requireKyb() && approveMutation.mutate(a)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                disabled={approveMutation.isPending}
                                onClick={() => setRejecting(a)}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardHeader>
              <CardTitle>Rejected Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Rejected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRejected ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                      ))
                    ) : rejectedApplications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          <XCircle className="h-10 w-10 mb-3 mx-auto opacity-30" />
                          No rejected applications.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rejectedApplications.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.firstName} {a.lastName}</TableCell>
                          <TableCell>{a.email}</TableCell>
                          <TableCell>{a.phone}</TableCell>
                          <TableCell className="text-muted-foreground">{a.rejectionReason || "—"}</TableCell>
                          <TableCell>{a.reviewedAt ? fmtDate(a.reviewedAt) : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Application — {rejecting?.firstName} {rejecting?.lastName}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Reason (optional)" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
              {rejectMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Applications;
