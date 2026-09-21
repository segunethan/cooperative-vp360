import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@jollify/shared/lib/supabase";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold">J</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Reset your password</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {sent ? "Check your inbox for a reset link." : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/8 border border-primary/20 text-sm text-foreground">
            <MailCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>If an account exists for <strong>{email}</strong>, a password reset link is on its way. It expires in 1 hour.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email" type="email" placeholder="you@example.com" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} className="h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : "Send reset link"}
              </Button>
            </form>
          </>
        )}

        <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
