import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Skeleton } from "@jollify/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jollify/shared/components/ui/tabs";
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
import {
  Building2,
  Users,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Crown,
  UserPlus,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCooperativeProfile,
  fetchTenantUsers,
  updateCooperativeProfile,
  updateTenantUserRole,
  updateEntranceFee,
} from "@jollify/shared/lib/api/settings";
import { nairaToKobo, formatMoneyFull } from "@jollify/shared/lib/money";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import MembershipLinkCard from "@/components/cooperative/members/MembershipLinkCard";

const PLAN_COLORS: Record<string, string> = {
  trial:      "bg-warning/10 text-warning border-warning/20",
  starter:    "bg-primary/10 text-primary border-primary/20",
  growth:     "bg-success/10 text-success border-success/20",
  enterprise: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const ROLE_COLORS: Record<string, string> = {
  admin:  "bg-primary/10 text-primary border-primary/20",
  staff:  "bg-success/10 text-success border-success/20",
  viewer: "bg-muted/10 text-muted-foreground border-border",
};

const Settings = () => {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? "";

  // ── Cooperative Profile ──────────────────────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["cooperative-profile", tenantId],
    queryFn: () => fetchCooperativeProfile(tenantId),
    enabled: !!tenantId,
  });

  const [profileForm, setProfileForm] = useState({
    name: "", email: "", phone: "", address: "", rcNumber: "",
  });

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        name:     profile.name,
        email:    profile.email,
        phone:    profile.phone ?? "",
        address:  profile.address ?? "",
        rcNumber: profile.rcNumber ?? "",
      });
    }
  }, [profile]);

  const profileDirty =
    profile &&
    (profileForm.name     !== profile.name     ||
     profileForm.email    !== profile.email    ||
     profileForm.phone    !== (profile.phone ?? "")    ||
     profileForm.address  !== (profile.address ?? "")  ||
     profileForm.rcNumber !== (profile.rcNumber ?? ""));

  const saveMutation = useMutation({
    mutationFn: () => updateCooperativeProfile(tenantId, profileForm),
    onSuccess: () => {
      toast.success("Cooperative profile updated.");
      queryClient.invalidateQueries({ queryKey: ["cooperative-profile", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Membership Settings (entrance fee + public application link) ────────────
  const [entranceFeeNaira, setEntranceFeeNaira] = useState("");

  useEffect(() => {
    if (profile) setEntranceFeeNaira(profile.entranceFeeKobo ? String(profile.entranceFeeKobo / 100) : "");
  }, [profile]);

  const entranceFeeDirty = profile && entranceFeeNaira !== (profile.entranceFeeKobo ? String(profile.entranceFeeKobo / 100) : "");

  const entranceFeeMutation = useMutation({
    mutationFn: () => updateEntranceFee(tenantId, entranceFeeNaira ? nairaToKobo(parseFloat(entranceFeeNaira)) : null),
    onSuccess: () => {
      toast.success("Entrance fee updated.");
      queryClient.invalidateQueries({ queryKey: ["cooperative-profile", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Team Members ─────────────────────────────────────────────────────────────
  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ["tenant-users", tenantId],
    queryFn: () => fetchTenantUsers(tenantId),
    enabled: !!tenantId,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      updateTenantUserRole(id, role),
    onSuccess: () => {
      toast.success("Role updated.");
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Trial expiry info
  const trialDaysLeft = profile?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(profile.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your cooperative profile and team access</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <Building2 className="h-4 w-4 mr-1.5" />Cooperative Profile
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-1.5" />Team
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="h-4 w-4 mr-1.5" />Roles
          </TabsTrigger>
          <TabsTrigger value="security">
            <Key className="h-4 w-4 mr-1.5" />Security
          </TabsTrigger>
        </TabsList>

        {/* ── Cooperative Profile ── */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Edit form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cooperative Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingProfile ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    ))
                  ) : (
                    <>
                      {/* Cooperative ID — read-only, system-assigned */}
                      {profile?.cooperativeNumber && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                          <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Cooperative ID</p>
                            <p className="font-mono font-bold text-lg text-foreground tracking-wider">{profile.cooperativeNumber}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">System-assigned · cannot be changed</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Cooperative Name *</Label>
                          <Input
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>URL Slug</Label>
                          <Input value={profile?.slug ?? ""} disabled className="font-mono text-sm" />
                          <p className="text-xs text-muted-foreground">Contact support to change your slug.</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Contact Email *</Label>
                        <Input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Phone Number</Label>
                        <Input
                          type="tel"
                          placeholder="+234 800 000 0000"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Registered Address</Label>
                        <Input
                          placeholder="e.g. 12 Marina Rd, Lagos Island, Lagos"
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>CAC Registration Number (RC Number)</Label>
                        <Input
                          placeholder="e.g. RC-1234567"
                          value={profileForm.rcNumber}
                          onChange={(e) => setProfileForm({ ...profileForm, rcNumber: e.target.value })}
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          disabled={!profileDirty || saveMutation.isPending}
                          onClick={() => saveMutation.mutate()}
                        >
                          {saveMutation.isPending ? "Saving…" : "Save Changes"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Membership Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Entrance Fee (₦)</Label>
                    <Input
                      type="number" min={0} placeholder="e.g. 5000"
                      value={entranceFeeNaira}
                      onChange={(e) => setEntranceFeeNaira(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Non-refundable fee new members must pay before their membership onboarding is approved.
                      {profile?.entranceFeeKobo ? ` Currently ${formatMoneyFull(profile.entranceFeeKobo)}.` : " Not set — onboarding will show no fee due."}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" disabled={!entranceFeeDirty || entranceFeeMutation.isPending} onClick={() => entranceFeeMutation.mutate()}>
                      {entranceFeeMutation.isPending ? "Saving…" : "Save Fee"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <MembershipLinkCard />
            </div>

            {/* Sidebar — plan + status */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    Billing Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingProfile ? (
                    <Skeleton className="h-8 w-full" />
                  ) : (
                    <>
                      <Badge
                        variant="outline"
                        className={PLAN_COLORS[profile?.billingPlan ?? "trial"] + " text-sm px-3 py-1"}
                      >
                        {(profile?.billingPlan ?? "trial").charAt(0).toUpperCase() +
                          (profile?.billingPlan ?? "trial").slice(1)} Plan
                      </Badge>

                      {profile?.billingPlan === "trial" && trialDaysLeft !== null && (
                        <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                          trialDaysLeft <= 5
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-warning/30 bg-warning/10 text-warning-foreground"
                        }`}>
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>
                            {trialDaysLeft === 0
                              ? "Trial has expired."
                              : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left on your trial.`}
                          </span>
                        </div>
                      )}

                      <Button className="w-full" size="sm" variant="outline">
                        Upgrade Plan
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingProfile ? (
                    <Skeleton className="h-6 w-full" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium capitalize">
                        {(profile?.status ?? "").toLowerCase().replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your cooperative account is in good standing.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="team" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Team Members</h3>
              <p className="text-sm text-muted-foreground">People with access to this cooperative's dashboard.</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTeam ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : teamMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                            <Users className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No team members found.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      teamMembers.map((member) => {
                        const isCurrentUser = member.userId === user?.id;
                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">
                                  {isCurrentUser ? user?.email : "Team member"}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {member.userId.slice(0, 8)}…
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ROLE_COLORS[member.role] ?? ""}>
                                {member.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {member.joinedAt}
                            </TableCell>
                            <TableCell>
                              {isCurrentUser ? (
                                <span className="text-xs text-muted-foreground">You</span>
                              ) : (
                                <Select
                                  value={member.role}
                                  onValueChange={(role) =>
                                    roleMutation.mutate({ id: member.id, role })
                                  }
                                  disabled={roleMutation.isPending}
                                >
                                  <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Roles (informational) ── */}
        <TabsContent value="roles" className="space-y-4">
          <h3 className="text-lg font-medium">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Roles control what each team member can see and do inside the dashboard.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                role: "Admin",
                color: "primary",
                description: "Full access to all modules including settings, user management, and financial operations.",
                permissions: ["All Modules", "Add & Remove Users", "Update Profile", "Approve Loans", "Manage Contributions"],
              },
              {
                role: "Staff",
                color: "success",
                description: "Operational access to day-to-day functions. Cannot change settings or manage users.",
                permissions: ["Members", "Contributions", "Loans", "Announcements", "Reports (Read)"],
              },
              {
                role: "Viewer",
                color: "muted-foreground",
                description: "Read-only access to the dashboard. Cannot create, update, or delete any records.",
                permissions: ["Dashboard (Read)", "Members (Read)", "Reports (Read)"],
              },
            ].map(({ role, color, description, permissions }) => (
              <Card key={role}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-base text-${color}`}>{role}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{description}</p>
                  <ul className="space-y-1.5">
                    {permissions.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security" className="space-y-4">
          <h3 className="text-lg font-medium">Security</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Password & Authentication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Authentication is managed by Supabase. Password resets are sent via email.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const { supabase: sb } = await import("@jollify/shared/lib/supabase");
                    await sb.auth.resetPasswordForEmail(user?.email ?? "", {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    toast.success("Password reset email sent.");
                  }}
                >
                  Send Password Reset Email
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">Signed in as</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sessions are managed by Supabase Auth and expire automatically.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
