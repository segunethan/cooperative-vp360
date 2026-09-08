import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Badge } from "@jollify/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jollify/shared/components/ui/table";
import { Checkbox } from "@jollify/shared/components/ui/checkbox";
import { Search, Download, Filter, Users } from "lucide-react";
import MemberActions from "./MemberActions";
import { useToast } from "@jollify/shared/hooks/use-toast";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import type { Member } from "@jollify/shared/lib/api/members";

interface MemberDirectoryProps {
  members: Member[];
  onApprove: (id: string) => void;
  onSuspend: (id: string) => void;
  onExit: (id: string) => void;
  onEdit: (id: string) => void;
  onVerifyKYC: (id: string) => void;
  onResendInvite?: (id: string) => void;
  loading?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-success/10 text-success border-success/20";
    case "Pending":
      return "bg-warning/10 text-warning border-warning/20";
    case "Suspended":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "Exited":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted/10 text-muted-foreground border-border";
  }
};

const MemberDirectory = ({ members, onApprove, onSuspend, onExit, onEdit, onVerifyKYC, onResendInvite, loading = false }: MemberDirectoryProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleAll = () => {
    if (selectedIds.length === paginatedMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedMembers.map((m) => m.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleExport = () => {
    toast({ title: "Exporting", description: `Exporting ${filteredMembers.length} member records...` });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Member Directory</CardTitle>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Bulk action", description: "Feature coming soon" })}>
              Bulk Action
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, email, or member ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="exited">Exited</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === paginatedMembers.length && paginatedMembers.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Member ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Contributions</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Loans</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No members found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {searchQuery || statusFilter !== "all"
                            ? "Try adjusting your search or filters."
                            : "Add your first member to get started."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(member.id)}
                        onCheckedChange={() => toggleOne(member.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{member.id}</TableCell>
                    <TableCell
                      className="cursor-pointer group"
                      onClick={() => navigate(`/cooperative/members/${member.id}`)}
                    >
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{member.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          member.kycVerified
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {member.kycVerified ? "Verified" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{member.contributionBalance}</TableCell>
                    <TableCell>{member.shareBalance}</TableCell>
                    <TableCell>{member.loanBalance}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.joinDate}</TableCell>
                    <TableCell>
                      <MemberActions
                        memberId={member.id}
                        memberStatus={member.status}
                        onApprove={onApprove}
                        onSuspend={onSuspend}
                        onExit={onExit}
                        onEdit={onEdit}
                        onVerifyKYC={onVerifyKYC}
                        onResendInvite={onResendInvite}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredMembers.length)} of {filteredMembers.length} members
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberDirectory;
