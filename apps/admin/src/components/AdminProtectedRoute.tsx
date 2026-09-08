import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const MEMBER_APP_URL = import.meta.env.VITE_MEMBER_APP_URL ?? "https://member.jollify.app";

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, tenant, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold">J</span>
          </div>
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Logged in, but this account has no cooperative admin record. Never guess —
  // show it plainly instead of bouncing into a portal this account may not belong to.
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-foreground font-medium">This account isn't a cooperative admin.</p>
          <p className="text-sm text-muted-foreground">
            If you're a cooperative member, sign in at{" "}
            <a href={MEMBER_APP_URL} className="text-primary hover:underline">
              {MEMBER_APP_URL.replace(/^https?:\/\//, "")}
            </a>{" "}
            instead.
          </p>
          <button onClick={() => signOut()} className="text-primary text-sm font-medium hover:underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
