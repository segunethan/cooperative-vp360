import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jollify/shared/components/ui/select";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import { UserPlus, CheckCircle2, Copy, Mail } from "lucide-react";
import { useToast } from "@jollify/shared/hooks/use-toast";
import { addNewMember, sendMemberInviteEmail, type NewMemberFormData } from "@jollify/shared/lib/api/members";
import { useAuth } from "@/context/AuthContext";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onMemberAdded: () => void;
}

const EMPTY: NewMemberFormData = {
  firstName: "", lastName: "", email: "", phone: "",
  gender: "", dateOfBirth: "", address: "", occupation: "",
};

const AddMemberDialog = ({ open, onOpenChange, tenantId, onMemberAdded }: AddMemberDialogProps) => {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const [form, setForm] = useState<NewMemberFormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ memberNumber: string; fullName: string; email: string } | null>(null);

  const set = (field: keyof NewMemberFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    setSuccess(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setError(null);
    setLoading(true);

    try {
      const result = await addNewMember(tenantId, form);
      setSuccess(result);
      onMemberAdded();

      // Send invite email in background — don't block the success state
      setSendingEmail(true);
      sendMemberInviteEmail(
        result.memberNumber,
        result.fullName,
        result.email,
        tenant?.name ?? "your cooperative",
        tenant?.cooperative_number
      )
        .then(() => {
          toast({ title: "Invite sent", description: `Email sent to ${result.email}` });
        })
        .catch(() => {
          toast({
            title: "Email not sent",
            description: "Member was registered but the invite email failed. Check your Resend API key.",
            variant: "destructive",
          });
        })
        .finally(() => setSendingEmail(false));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add member";
      setError(msg.includes("unique") ? "A member with this email already exists." : msg);
    } finally {
      setLoading(false);
    }
  };

  const copyMemberId = () => {
    if (success) {
      navigator.clipboard.writeText(success.memberNumber);
      toast({ title: "Copied", description: `${success.memberNumber} copied to clipboard.` });
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[440px]">
          <div className="flex flex-col items-center text-center py-4 space-y-5">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground">Member Registered</h2>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{success.fullName}</span> has been added to your cooperative.
              </p>
            </div>

            {/* Member ID badge */}
            <div className="w-full rounded-xl border border-border bg-muted/40 p-4 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member ID</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-bold font-mono text-foreground tracking-wider">
                  {success.memberNumber}
                </span>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={copyMemberId}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Email status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              {sendingEmail ? (
                <span>Sending invite to <span className="font-medium">{success.email}</span>…</span>
              ) : (
                <span>Invite sent to <span className="font-medium">{success.email}</span></span>
              )}
            </div>

            <div className="flex gap-3 w-full pt-1">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => { setSuccess(null); setForm(EMPTY); }}
              >
                Add Another
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add New Member
          </DialogTitle>
          <DialogDescription>
            Register a new cooperative member. A member ID will be auto-assigned and an invite email sent.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" placeholder="John" required value={form.firstName} onChange={set("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" placeholder="Doe" required value={form.lastName} onChange={set("lastName")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address *</Label>
              <Input id="email" type="email" placeholder="john@example.com" required value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input id="phone" placeholder="+234 801 234 5678" required value={form.phone} onChange={set("phone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm((p) => ({ ...p, gender: v }))}>
                <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Residential Address</Label>
            <Textarea
              id="address"
              placeholder="12 Marina Road, Lagos Island, Lagos"
              rows={2}
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" placeholder="Software Engineer, Teacher, etc." value={form.occupation} onChange={set("occupation")} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !tenantId}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Registering…
                </span>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Register & Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog;
