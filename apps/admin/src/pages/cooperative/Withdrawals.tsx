import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Input } from "@jollify/shared/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@jollify/shared/components/ui/table";
import { Banknote, Check, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  fetchPendingWithdrawalRequests,
  fetchApprovedWithdrawalRequests,
  reviewWithdrawalRequest,
  markWithdrawalPaid,
  type WithdrawalRequestRow,
} from "@jollify/shared/lib/api/withdrawals";

const PendingRow = ({ request }: { request: WithdrawalRequestRow }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["withdrawal-requests-pending"] });
    queryClient.invalidateQueries({ queryKey: ["withdrawal-requests-approved"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  };

  const reviewMutation = useMutation({
    mutationFn: (approve: boolean) => reviewWithdrawalRequest(request.id, approve, user?.id ?? "", approve ? undefined : reason),
    onSuccess: (_, approve) => {
      toast.success(approve ? "Withdrawal approved — mark it paid once the transfer is sent." : "Withdrawal rejected.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{request.memberName}</p>
        <p className="text-xs text-muted-foreground font-mono">{request.memberNumber}</p>
      </TableCell>
      <TableCell className="font-medium">{request.amount}</TableCell>
      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={request.reason}>{request.reason}</TableCell>
      <TableCell className="text-sm">
        <p>{request.bankName}</p>
        <p className="text-xs text-muted-foreground">{request.accountNumber} · {request.accountName}</p>
      </TableCell>
      <TableCell>{new Date(request.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
      <TableCell className="text-right">
        {rejecting ? (
          <div className="flex items-center justify-end gap-1.5">
            <Input
              className="h-8 w-40 text-xs" placeholder="Reason for rejection"
              value={reason} onChange={(e) => setReason(e.target.value)}
            />
            <Button
              size="sm" variant="destructive" className="h-8" disabled={reviewMutation.isPending || !reason.trim()}
              onClick={() => reviewMutation.mutate(false)}
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setRejecting(false); setReason(""); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm" variant="ghost" className="text-success hover:text-success" disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate(true)}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRejecting(true)}>
              <X className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};

const ApprovedRow = ({ request }: { request: WithdrawalRequestRow }) => {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");

  const payMutation = useMutation({
    mutationFn: () => markWithdrawalPaid(request.id, reference.trim() || undefined),
    onSuccess: () => {
      toast.success("Withdrawal marked as paid.");
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests-approved"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{request.memberName}</p>
        <p className="text-xs text-muted-foreground font-mono">{request.memberNumber}</p>
      </TableCell>
      <TableCell className="font-medium">{request.amount}</TableCell>
      <TableCell className="text-sm">
        <p>{request.bankName}</p>
        <p className="text-xs text-muted-foreground">{request.accountNumber} · {request.accountName}</p>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Input
            className="h-8 w-36 text-xs" placeholder="Transfer ref (optional)"
            value={reference} onChange={(e) => setReference(e.target.value)}
          />
          <Button size="sm" disabled={payMutation.isPending} onClick={() => payMutation.mutate()}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Mark as Paid
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const Withdrawals = () => {
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["withdrawal-requests-pending"],
    queryFn: fetchPendingWithdrawalRequests,
  });

  const { data: approved = [], isLoading: loadingApproved } = useQuery({
    queryKey: ["withdrawal-requests-approved"],
    queryFn: fetchApprovedWithdrawalRequests,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Banknote className="h-6 w-6 text-primary" />
          Withdrawals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review member requests to withdraw from their contribution balance. Approving authorizes the payout —
          the balance only drops once you mark it paid after the bank transfer actually goes out.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Pending Review
            {pending.length > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Bank Details</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                ) : pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                        <Banknote className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">No pending withdrawal requests</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((r) => <PendingRow key={r.id} request={r} />)
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Approved — Awaiting Payment
            {approved.length > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{approved.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bank Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingApproved ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                ) : approved.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                        <Banknote className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">Nothing awaiting payment</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  approved.map((r) => <ApprovedRow key={r.id} request={r} />)
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Withdrawals;
