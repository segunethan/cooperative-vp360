import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { ShieldCheck, Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchPendingKyc, type PendingKycRow } from "@jollify/shared/lib/api/kyc";
import KycReviewDialog from "@/components/cooperative/kyc/KycReviewDialog";

const Kyc = () => {
  const [reviewing, setReviewing] = useState<PendingKycRow | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["pending-kyc"],
    queryFn: fetchPendingKyc,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KYC Review</h1>
        <p className="text-muted-foreground">Review member-submitted bank details, identity documents, and next of kin information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                        <Inbox className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">No pending KYC submissions</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.memberName}</p>
                        <p className="text-xs text-muted-foreground">{s.memberNumber}</p>
                      </TableCell>
                      <TableCell>{s.bankName}</TableCell>
                      <TableCell>{s.idType.replace("_", " ")}</TableCell>
                      <TableCell>{new Date(s.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setReviewing(s)}>
                          <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <KycReviewDialog submission={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
};

export default Kyc;
