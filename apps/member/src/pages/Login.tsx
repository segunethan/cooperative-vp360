import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL ?? "https://admin.jollify.app";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, reloadMember, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(form.email, form.password);
    if (error) {
      setLoading(false);
      setError(error === "Invalid login credentials" ? "Incorrect email or password." : error);
      return;
    }

    const member = await reloadMember();
    setLoading(false);

    if (member) {
      navigate("/member", { replace: true });
      return;
    }

    // No member record for this account — never guess, just say so.
    await signOut();
    setError(
      `No member account found for this email. Cooperative staff sign in at ${ADMIN_APP_URL.replace(/^https?:\/\//, "")}.`
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold">J</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Sign in to your member account.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Sign in <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          New members are invited by their cooperative admin — check your email for a setup link.
        </p>
      </div>
    </div>
  );
};

export default Login;
