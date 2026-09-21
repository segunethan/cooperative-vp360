import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { fetchTenantPublicInfo, submitMemberApplication } from "@jollify/shared/lib/api/applications";
import { CheckCircle2, Building2 } from "lucide-react";

const Apply = () => {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", about: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: tenant, isLoading, error: tenantError } = useQuery({
    queryKey: ["tenant-public-info", slug],
    queryFn: () => fetchTenantPublicInfo(slug!),
    enabled: !!slug,
    retry: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setError(null);
    setLoading(true);
    try {
      await submitMemberApplication({
        tenantId: tenant.id,
        cooperativeName: tenant.name,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        about: form.about,
      });
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Cooperative not found</p>
          <p className="text-sm text-muted-foreground">This application link isn't valid. Double check the link with your cooperative.</p>
          <Link to="/" className="text-primary text-sm font-medium hover:underline">Back to Jollify</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Apply to join {tenant.name}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {submitted ? "Your application has been received." : "Tell us a bit about yourself to get started."}
          </p>
        </div>

        {submitted ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/8 border border-primary/20 text-sm text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p>{tenant.name} will review your application. If approved, you'll receive an email invite to set up your member account.</p>
          </div>
        ) : (
          <>
            {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input id="fullName" required autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" type="tel" required autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="about">Tell us a bit about yourself</Label>
                <Textarea id="about" rows={3} placeholder="Why do you want to join?" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
              </div>
              <Button type="submit" className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" disabled={loading}>
                {loading ? "Submitting…" : "Submit Application"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Apply;
