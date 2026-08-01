import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", remember: false });

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

    // Primary check: security-definer RPC bypasses RLS circular dependency
    const { data: tenantId } = await supabase.rpc("get_tenant_id");

    if (tenantId) {
      setLoading(false);
      navigate("/cooperative", { replace: true });
      return;
    }

    // Fallback: direct query (works once tenant_users_self_read policy is applied)
    const { data: adminRecord } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .maybeSingle();

    setLoading(false);
    navigate(adminRecord ? "/cooperative" : "/member", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0A0A0A] flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(42 55% 55%) 1px, transparent 1px), linear-gradient(90deg, hsl(42 55% 55%) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <Link to="/" className="flex items-center gap-3 relative group">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center group-hover:bg-primary/80 transition-colors">
            <span className="text-primary-foreground font-bold">J</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight group-hover:text-white/80 transition-colors">Jollify</span>
        </Link>

        <div className="relative space-y-8">
          <blockquote className="text-white/90 text-2xl font-light leading-relaxed tracking-tight">
            "Every naira tracked. Every member served. Every cooperative empowered."
          </blockquote>

          <div className="space-y-4">
            {[
              "Double-entry ledger — every kobo traceable",
              "Bank-grade tenant isolation via Postgres RLS",
              "Paystack-integrated contribution collection",
            ].map((point) => (
              <div key={point} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <span className="text-white/60 text-sm">{point}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs relative">© 2025 Jollify. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <Link to="/" className="flex items-center gap-2.5 lg:hidden group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:bg-primary/80 transition-colors">
              <span className="text-primary-foreground font-bold text-sm">J</span>
            </div>
            <span className="font-bold text-lg tracking-tight group-hover:text-foreground/70 transition-colors">Jollify</span>
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Sign in to your cooperative admin console.
            </p>
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
                placeholder="admin@yourcooperative.com"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  Forgot password?
                </Link>
              </div>
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={form.remember}
                onCheckedChange={(v) => setForm({ ...form, remember: !!v })}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="remember" className="text-sm text-muted-foreground font-normal cursor-pointer">
                Keep me signed in for 30 days
              </Label>
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

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your session is protected with bank-grade encryption. We never store your password in plain text.
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-medium hover:text-primary/80 transition-colors">
              Register your cooperative
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
