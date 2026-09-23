import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@jollify/shared/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { useToast } from "@jollify/shared/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import MemberStatsCards from "@/components/cooperative/members/MemberStatsCards";
import MemberDirectory from "@/components/cooperative/members/MemberDirectory";
import AddMemberDialog from "@/components/cooperative/members/AddMemberDialog";
import BulkImportDialog from "@/components/cooperative/members/BulkImportDialog";
import MembershipLinkCard from "@/components/cooperative/members/MembershipLinkCard";
import {
  fetchAllMembers,
  approveMemberApplication,
  suspendMember,
  exitMember,
  sendMemberInviteEmail,
} from "@jollify/shared/lib/api/members";
import { useState } from "react";
import { useKybGate } from "@/hooks/useKybGate";

const Members = () => {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { requireKyb } = useKybGate();

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: fetchAllMembers,
    enabled: !!tenant,
  });

  const stats = {
    total: members.length,
    active: members.filter((m) => m.status === "Active").length,
    pending: members.filter((m) => m.status === "Pending").length,
    exited: members.filter((m) => m.status === "Exited").length,
  };

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ["members"] });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async (memberNumber: string) => {
      const member = members.find((m) => m.id === memberNumber);
      await approveMemberApplication(memberNumber);
      if (member) {
        await sendMemberInviteEmail(
          memberNumber,
          member.name,
          member.email,
          tenant?.name ?? "your cooperative",
          tenant?.cooperative_number
        );
      }
    },
    onSuccess: (_, memberNumber) => {
      invalidateMembers();
      toast({ title: "Member Approved", description: `${memberNumber} is now active — an invite email has been sent.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: suspendMember,
    onSuccess: (_, memberNumber) => {
      invalidateMembers();
      toast({ title: "Member Suspended", description: `${memberNumber} has been suspended.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const exitMutation = useMutation({
    mutationFn: exitMember,
    onSuccess: (_, memberNumber) => {
      invalidateMembers();
      toast({ title: "Member Exited", description: `${memberNumber} has exited the cooperative.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (memberNumber: string) => {
      const member = members.find((m) => m.id === memberNumber);
      if (!member) throw new Error("Member not found");
      await sendMemberInviteEmail(
        memberNumber,
        member.name,
        member.email,
        tenant?.name ?? "your cooperative",
        tenant?.cooperative_number
      );
    },
    onSuccess: (_, memberNumber) => {
      toast({ title: "Invitation sent", description: `Invite resent to ${memberNumber}.` });
    },
    onError: (err: Error) => toast({ title: "Failed to resend", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleApprove = (id: string) => approveMutation.mutate(id);
  const handleSuspend = (id: string) => suspendMutation.mutate(id);
  const handleExit = (id: string) => exitMutation.mutate(id);
  const handleEdit = (id: string) => toast({ title: "Edit Member", description: `Opening editor for ${id}…` });

  const handleVerifyKYC = () => navigate("/cooperative/kyc");
  const handleResendInvite = (id: string) => resendInviteMutation.mutate(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground">Manage your cooperative members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => requireKyb() && setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button size="sm" onClick={() => requireKyb() && setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      <MembershipLinkCard />

      <MemberStatsCards stats={stats} />

      <MemberDirectory
        members={members}
        loading={isLoading}
        onApprove={handleApprove}
        onSuspend={handleSuspend}
        onExit={handleExit}
        onEdit={handleEdit}
        onVerifyKYC={handleVerifyKYC}
        onResendInvite={handleResendInvite}
      />

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenant?.id ?? ""}
        onMemberAdded={invalidateMembers}
      />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} onImported={invalidateMembers} />
    </div>
  );
};

export default Members;
