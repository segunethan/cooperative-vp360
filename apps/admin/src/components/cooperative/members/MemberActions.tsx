import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@jollify/shared/components/ui/dropdown-menu";
import { Button } from "@jollify/shared/components/ui/button";
import { MoreHorizontal, Eye, Pencil, UserCheck, UserX, ShieldCheck, Ban, MessageSquare, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MemberActionsProps {
  memberId: string;
  memberStatus: string;
  onApprove?: (id: string) => void;
  onSuspend?: (id: string) => void;
  onExit?: (id: string) => void;
  onEdit?: (id: string) => void;
  onVerifyKYC?: (id: string) => void;
  onResendInvite?: (id: string) => void;
}

const MemberActions = ({
  memberId,
  memberStatus,
  onApprove,
  onSuspend,
  onExit,
  onEdit,
  onVerifyKYC,
  onResendInvite,
}: MemberActionsProps) => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate(`/cooperative/members/${memberId}`)}>
          <Eye className="h-4 w-4 mr-2" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit?.(memberId)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {memberStatus === "Pending" && (
          <DropdownMenuItem onClick={() => onApprove?.(memberId)} className="text-success">
            <UserCheck className="h-4 w-4 mr-2" />
            Approve Member
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onVerifyKYC?.(memberId)}>
          <ShieldCheck className="h-4 w-4 mr-2" />
          Verify KYC (NIBSS)
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MessageSquare className="h-4 w-4 mr-2" />
          Send Message
        </DropdownMenuItem>
        {(memberStatus === "Pending" || memberStatus === "Invited") && (
          <DropdownMenuItem onClick={() => onResendInvite?.(memberId)}>
            <Mail className="h-4 w-4 mr-2" />
            Resend Invitation
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {memberStatus === "Active" && (
          <DropdownMenuItem onClick={() => onSuspend?.(memberId)} className="text-warning">
            <Ban className="h-4 w-4 mr-2" />
            Suspend Member
          </DropdownMenuItem>
        )}
        {memberStatus !== "Exited" && (
          <DropdownMenuItem onClick={() => onExit?.(memberId)} className="text-destructive">
            <UserX className="h-4 w-4 mr-2" />
            Exit Member
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MemberActions;
