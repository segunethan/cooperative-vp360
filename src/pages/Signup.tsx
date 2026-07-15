import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Building2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Step = "form" | "verify-otp";

const Signup = () => {
  const navigate = useNavigate();
  const { reloadTenant } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [form, setForm] = useState({
    cooperativeName: "",
    email: "",
    phone: "",
    password: "",
  });

  const slugify = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const startResendCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResendCountdown(60);
    countdownRef.current = setInterval(() => {
      setResendCountdown((v) => {
        if (v <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const callRegisterFunction = async (resend = false) => {
    const { error: fnError } = await supabase.functions.invoke("register-cooperative", {
      body: {
        email: form.email,
        password: form.password,
        cooperativeName: form.cooperativeName,
        resend,
      },
    });
    if (fnError) {
      // FunctionsHttpError wraps the actual body in .context (a Response object)
      if (fnError.context && typeof fnError.context.json === "function") {
        try {
          const body = await fnError.context.json();
          throw new Error(body?.error ?? "Failed to send verification email.");
        } catch (parseErr) {
          if (parseErr instanceof Error && !parseErr.message.includes("Failed to send")) throw parseErr;
        }
      }
      throw new Error("Failed to send verification email. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await callRegisterFunction(false);
      setStep("verify-otp");
      setOtp(["", "", "", "", "", ""]);
      startResendCountdown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setOtpError(null);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleVerifyOtp = async () => {
    const token = otp.join("");
    if (token.length !== 6) { setOtpError("Enter all 6 digits."); return; }
    setOtpError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: form.email,
        token,
        type: "signup",
      });
      if (verifyError) throw new Error("Invalid or expired code. Check your email and try again.");

      const { error: tenantError } = await supabase.rpc("create_tenant", {
        p_name: form.cooperativeName,
        p_email: form.email,
        p_slug: slugify(form.cooperativeName),
        p_phone: form.phone || null,
      });
      if (tenantError) throw new Error(tenantError.message);

      await reloadTenant();
      navigate("/cooperative", { replace: true });
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    try {
      await callRegisterFunction(true);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      startResendCountdown();
    } catch {
      setOtpError("Failed to resend code. Please try again.");
    }
  };

  // ── Left panel (shared) ────────────────────────────────────────────────────
  const LeftPanel = () => (
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
        <blockquote className="text-white/90 text-2xl font-light leading-relaxed tracking-tight">
          "Set up in minutes. Serve your members from day one."
        </blockquote>
        <div className="space-y-4">
          {[
            "30-day free trial — no card required",
            "All member data encrypted and isolated",
            "Paystack integration ready out of the box",
          ].map((point) => (
            <div key={point} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c1ecd4]" />
              </div>
              <span className="text-white/60 text-sm">{point}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-white/20 text-xs relative">© 2026 Jollify. All rights reserved.</p>
    </div>
  );

  // ── OTP verification screen ────────────────────────────────────────────────
  if (step === "verify-otp") {
    return (
      <div className="min-h-screen bg-background flex">
        <LeftPanel />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">J</span>
              </div>
              <span className="font-bold text-lg tracking-tight">Jollify</span>
            </div>

            {/* Header */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">Email Verification</p>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Check your inbox</h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                We sent a 6-digit verification code to{" "}
                <strong className="text-foreground">{form.email}</strong>. Enter it below to activate your account.
              </p>
            </div>

            {otpError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {otpError}
              </div>
            )}

            {/* OTP boxes */}
            <div className="space-y-6">
              <div>
                <Label className="text-sm mb-3 block">Verification code</Label>
                <div className="flex gap-3 justify-between" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-input bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={handleVerifyOtp}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                disabled={loading || otp.join("").length !== 6}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Verify & activate account <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              {/* Resend */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCountdown > 0}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("form"); setOtpError(null); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Wrong email?
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Didn't get it?</strong> Check your spam folder. The code expires in 1 hour. Make sure you're checking the inbox for <strong>{form.email}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">
      <LeftPanel />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">J</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Jollify</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Register your cooperative</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Create your admin account and start managing your cooperative.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="cooperativeName">Cooperative name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cooperativeName"
                  placeholder="Lagos Teachers Cooperative Society"
                  required
                  value={form.cooperativeName}
                  onChange={(e) => setForm({ ...form, cooperativeName: e.target.value })}
                  className="pl-10 h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Admin email address</Label>
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
              <Label htmlFor="phone">
                Phone number{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create account <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
