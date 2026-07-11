import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type Stage = "loading" | "set-password" | "success" | "error";

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts tokens in the URL fragment after verifying the invite link
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Fetch their member record to show their name
        const { data } = await supabase
          .from("members")
          .select("full_name")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        if (data?.full_name) setMemberName(data.full_name);
        setStage("set-password");
      }
      if (event === "USER_UPDATED") {
        setStage("success");
        setTimeout(() => navigate("/member"), 2000);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStage("set-password");
      else {
        // If no session and no hash params, something is wrong
        const hash = window.location.hash;
        if (!hash.includes("access_token")) setStage("error");
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) setError(updateError.message);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying your invite link…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">✗</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Invalid or expired link</h1>
          <p className="text-sm text-muted-foreground">
            This invite link has expired or already been used. Contact your cooperative administrator for a new one.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Account ready!</h1>
          <p className="text-sm text-muted-foreground">Taking you to your member portal…</p>
        </div>
      </div>
    );
  }

  // ── Set password ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#012d1d] flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #c1ecd4 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="flex items-center gap-3 relative">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white font-bold">J</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Jollify</span>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-white/90 text-3xl font-bold leading-tight tracking-tight">
            Welcome to your cooperative.
          </h2>
          <p className="text-white/50 text-base leading-relaxed">
            Set a password to access your member account — view your contributions, loan status, and cooperative announcements.
          </p>
        </div>
        <p className="text-white/20 text-xs relative">© 2026 Jollify. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-2">Member Onboarding</p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {memberName ? `Hi ${memberName.split(" ")[0]}, set your password` : "Set your password"}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Choose a strong password to secure your cooperative account.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="At least 8 characters"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat your password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Activate my account <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
