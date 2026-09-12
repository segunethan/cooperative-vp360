import { Link } from "react-router-dom";
import { BadgeCheck, ShieldAlert, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMemberProfile } from "@/hooks/useMemberProfile";

const Profile = () => {
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useMemberProfile();

  if (isLoading || !profile) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Profile</h1>

      <div className="bg-white rounded-xl border border-border p-5 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Full Name</p>
          <p className="text-sm font-medium text-foreground">{profile.fullName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm font-medium text-foreground">{profile.email}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Member ID</p>
          <p className="text-sm font-medium text-foreground font-mono">{profile.memberNumber}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cooperative</p>
          <p className="text-sm font-medium text-foreground">{profile.cooperativeName}</p>
        </div>
      </div>

      <Link to="/member/kyc" className="flex items-center gap-3 bg-white rounded-xl border border-border p-4 hover:border-primary/40 transition-colors">
        {profile.kycVerified ? (
          <BadgeCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">KYC Status</p>
          <p className="text-xs text-muted-foreground">{profile.kycVerified ? "Verified" : "Not yet verified — tap to complete"}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </Link>

      <button
        onClick={() => signOut()}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
};

export default Profile;
