import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@jollify/shared/components/ui/card";
import { Button } from "@jollify/shared/components/ui/button";
import { Input } from "@jollify/shared/components/ui/input";
import { Label } from "@jollify/shared/components/ui/label";
import { Textarea } from "@jollify/shared/components/ui/textarea";
import Stepper from "@jollify/shared/components/Stepper";
import { ShieldCheck, FileText, ExternalLink, Building2 } from "lucide-react";
import { fetchOwnKyb, submitKyb, type KybFormData } from "@jollify/shared/lib/api/kyb";
import { formatMoneyFull, nairaToKobo, generatePaymentReference } from "@jollify/shared/lib/money";
import { supabase } from "@jollify/shared/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Business Details", "Fees & Settlement Account", "Compliance & Declaration"];

const EMPTY_FORM: KybFormData = {
  name: "", rcNumber: "", address: "", phone: "",
  entranceFeeKobo: undefined, bankAccountInfo: "",
  cacCertificateUrl: undefined, authorizedSignatoryName: "",
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const uploadCacCertificate = async (tenantId: string, file: File): Promise<string | null> => {
  const ext = file.name.split(".").pop() ?? "bin";
  const ref = generatePaymentReference("CAC");
  const path = `${tenantId}/${ref}.${ext}`;
  const { data, error } = await supabase.storage.from("kyb-documents").upload(path, file, { contentType: file.type, upsert: false });
  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from("kyb-documents").getPublicUrl(data.path);
  return urlData.publicUrl;
};

const Kyb = () => {
  const navigate = useNavigate();
  const { tenant, reloadTenant } = useAuth();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["own-kyb", tenant?.id],
    queryFn: () => fetchOwnKyb(tenant!.id),
    enabled: !!tenant,
  });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<KybFormData>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [entranceFeeNaira, setEntranceFeeNaira] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing || !tenant) return;
    if (existing.status === "KYB_REJECTED" || existing.status === "KYB_SUBMITTED" || existing.status === "PENDING_EMAIL_VERIFICATION" || existing.status === "EMAIL_VERIFIED") {
      setForm({
        name: existing.name || tenant.name || "",
        rcNumber: existing.rcNumber ?? "",
        address: existing.address ?? "",
        phone: existing.phone ?? "",
        entranceFeeKobo: existing.entranceFeeKobo ?? undefined,
        bankAccountInfo: existing.bankAccountInfo ?? "",
        cacCertificateUrl: existing.cacCertificateUrl ?? undefined,
        authorizedSignatoryName: existing.authorizedSignatoryName ?? "",
      });
      setEntranceFeeNaira(existing.entranceFeeKobo ? String(existing.entranceFeeKobo / 100) : "");
    }
  }, [existing, tenant]);

  const set = <K extends keyof KybFormData>(key: K) => (value: KybFormData[K]) => setForm((f) => ({ ...f, [key]: value }));

  const stepErrors: Record<number, Record<string, string>> = {
    0: {
      name: form.name.trim() ? "" : "Required",
      rcNumber: form.rcNumber.trim() ? "" : "Required",
      address: form.address.trim() ? "" : "Required",
      phone: form.phone.trim() ? "" : "Required",
    },
    1: {
      bankAccountInfo: form.bankAccountInfo.trim() ? "" : "Required — where members will pay their entrance fee",
    },
    2: {
      authorizedSignatoryName: form.authorizedSignatoryName.trim() ? "" : "Required",
      cacCertificate: certFile || form.cacCertificateUrl ? "" : "Upload your CAC certificate",
      declared: declared ? "" : "You must confirm this to submit",
    },
  };

  const isStepValid = (s: number) => Object.values(stepErrors[s] ?? {}).every((e) => !e);
  const errFor = (key: string) => (touched ? stepErrors[step]?.[key] : undefined);

  const handleNext = () => {
    setTouched(true);
    if (isStepValid(step)) { setStep((s) => Math.min(s + 1, STEPS.length - 1)); setTouched(false); }
  };

  const handleSubmit = async () => {
    if (!tenant) return;
    setTouched(true);
    if (!isStepValid(2)) return;
    setError(null);
    setSubmitting(true);
    try {
      let cacCertificateUrl = form.cacCertificateUrl;
      if (certFile) {
        cacCertificateUrl = (await uploadCacCertificate(tenant.id, certFile)) ?? undefined;
      }
      await submitKyb(tenant.id, {
        ...form,
        entranceFeeKobo: entranceFeeNaira ? nairaToKobo(parseFloat(entranceFeeNaira)) : undefined,
        cacCertificateUrl,
      });
      await reloadTenant();
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;

  if (existing?.status === "KYB_SUBMITTED" && !submitted) {
    return (
      <div className="py-16 text-center space-y-3">
        <ShieldCheck className="h-10 w-10 text-amber-500 mx-auto" />
        <p className="font-semibold text-foreground">Your business verification is under review</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Submitted {fmtDate(existing.submittedAt)}. Jollify reviews new cooperatives before member invitations are unlocked — we'll notify you by email once it's approved.
        </p>
      </div>
    );
  }

  if (existing?.status === "ACTIVE") {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="text-center space-y-2 py-4">
          <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
          <p className="font-semibold text-foreground">Your cooperative is verified</p>
          <p className="text-sm text-muted-foreground">You can invite members and start accepting contributions.</p>
        </div>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Submitted {fmtDate(existing.submittedAt)}</span>
              {existing.reviewedAt && <span>· Approved {fmtDate(existing.reviewedAt)}</span>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Business Details</p>
              <p className="text-sm text-foreground">{existing.name} · RC {existing.rcNumber || "—"}</p>
              <p className="text-sm text-muted-foreground">{existing.address}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fees & Settlement</p>
              <p className="text-sm text-foreground">{existing.entranceFeeKobo ? formatMoneyFull(existing.entranceFeeKobo) : "No entrance fee"}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{existing.bankAccountInfo}</p>
            </div>
            {existing.cacCertificateUrl && (
              <a href={existing.cacCertificateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline">
                <FileText className="h-3.5 w-3.5" /> View CAC certificate <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
        <p className="font-semibold text-foreground">Business verification submitted</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Jollify will review your submission shortly. You'll be able to invite members once it's approved.</p>
        <Button variant="outline" onClick={() => navigate("/cooperative")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {existing?.status === "KYB_REJECTED" ? "Update your business verification" : "Complete your business verification"}
        </h1>
        <p className="text-muted-foreground">Required once, before you can invite members or accept applications.</p>
        {existing?.status === "KYB_REJECTED" && existing.rejectionReason && (
          <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{existing.rejectionReason}</p>
        )}
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}

      <Card>
        <CardContent className="p-5 space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Cooperative Name *</Label>
                <Input value={form.name} onChange={(e) => set("name")(e.target.value)} />
                {errFor("name") && <p className="text-xs text-red-600">{errFor("name")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>CAC Registration Number (RC Number) *</Label>
                <Input placeholder="e.g. RC-1234567" value={form.rcNumber} onChange={(e) => set("rcNumber")(e.target.value)} />
                {errFor("rcNumber") && <p className="text-xs text-red-600">{errFor("rcNumber")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Registered Address *</Label>
                <Input placeholder="e.g. 12 Marina Rd, Lagos Island, Lagos" value={form.address} onChange={(e) => set("address")(e.target.value)} />
                {errFor("address") && <p className="text-xs text-red-600">{errFor("address")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number *</Label>
                <Input type="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
                {errFor("phone") && <p className="text-xs text-red-600">{errFor("phone")}</p>}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Entrance Fee (₦)</Label>
                <Input type="number" min={0} placeholder="e.g. 5000" value={entranceFeeNaira} onChange={(e) => setEntranceFeeNaira(e.target.value)} />
                <p className="text-xs text-muted-foreground">Non-refundable fee new members pay before their onboarding is approved. Leave blank if there's no entrance fee.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Settlement Bank Account *</Label>
                <Textarea
                  placeholder="Bank, account number, and account name — e.g. GTBank, 0123456789, GopherWood Cooperative Ltd"
                  rows={3}
                  value={form.bankAccountInfo}
                  onChange={(e) => set("bankAccountInfo")(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Shown to members during onboarding so they know where to pay the entrance fee.</p>
                {errFor("bankAccountInfo") && <p className="text-xs text-red-600">{errFor("bankAccountInfo")}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label>CAC Certificate *</Label>
                <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/4 transition-colors ${errFor("cacCertificate") ? "border-red-300" : "border-border"}`}>
                  <span className="text-xs font-medium text-muted-foreground px-4 text-center">
                    {certFile ? certFile.name : form.cacCertificateUrl ? "Certificate on file — click to replace" : "Upload a photo or scan of your CAC registration certificate"}
                  </span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
                </label>
                {errFor("cacCertificate") && <p className="text-xs text-red-600">{errFor("cacCertificate")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Authorized Signatory — Full Name *</Label>
                <Input placeholder="Type your full legal name" value={form.authorizedSignatoryName} onChange={(e) => set("authorizedSignatoryName")(e.target.value)} />
                {errFor("authorizedSignatoryName") && <p className="text-xs text-red-600">{errFor("authorizedSignatoryName")}</p>}
              </div>
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border cursor-pointer">
                <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
                <span className="text-sm text-foreground">I confirm the information provided is accurate and I am authorized to register this cooperative on Jollify.</span>
              </label>
              {errFor("declared") && <p className="text-xs text-red-600">{errFor("declared")}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => { setStep((s) => s - 1); setTouched(false); }}>Back</Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={handleNext}>Next</Button>
        ) : (
          <Button className="flex-1" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit for Review"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Kyb;
