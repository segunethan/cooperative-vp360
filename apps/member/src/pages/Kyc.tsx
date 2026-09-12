import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useMemberProfile, useInvalidateMemberProfile } from "@/hooks/useMemberProfile";
import { submitKyc, fetchOwnKyc, type KycFormData, type KycIdType } from "@jollify/shared/lib/api/kyc";
import { useQuery } from "@tanstack/react-query";

const STEPS = ["Bank Details", "Identity Document", "Next of Kin", "Review"];

const EMPTY_FORM: KycFormData = {
  bankName: "", accountNumber: "", accountName: "", bvn: "",
  secretQuestion: "", secretAnswer: "",
  idType: "NIN", idNumber: "", idExpiryDate: "",
  nextOfKinName: "", nextOfKinRelationship: "", nextOfKinPhone: "", nextOfKinAddress: "",
};

const idTypeLabel: Record<KycIdType, string> = {
  NIN: "National ID (NIN)",
  PASSPORT: "International Passport",
  DRIVERS_LICENSE: "Driver's License",
  VOTERS_CARD: "Voter's Card",
};

const Field = ({
  label, value, onChange, placeholder, type = "text", autoComplete, error,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string; error?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label} *</label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-11 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${error ? "border-red-300" : "border-input focus:border-primary"}`}
    />
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const Kyc = () => {
  const navigate = useNavigate();
  const { data: profile } = useMemberProfile();
  const invalidateProfile = useInvalidateMemberProfile();

  const { data: existing } = useQuery({
    queryKey: ["own-kyc", profile?.memberId],
    queryFn: () => fetchOwnKyc(profile!.memberId),
    enabled: !!profile,
  });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<KycFormData>(EMPTY_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && (existing.status === "REJECTED" || existing.status === "PENDING")) {
      setForm({
        bankName: existing.bankName, accountNumber: existing.accountNumber, accountName: existing.accountName, bvn: existing.bvn,
        secretQuestion: existing.secretQuestion, secretAnswer: existing.secretAnswer,
        idType: existing.idType, idNumber: existing.idNumber, idExpiryDate: existing.idExpiryDate,
        nextOfKinName: existing.nextOfKinName, nextOfKinRelationship: existing.nextOfKinRelationship,
        nextOfKinPhone: existing.nextOfKinPhone, nextOfKinAddress: existing.nextOfKinAddress,
      });
    }
  }, [existing]);

  const set = (key: keyof KycFormData) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const markTouched = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const stepErrors: Record<number, Record<string, string>> = {
    0: {
      bankName: form.bankName ? "" : "Required",
      accountNumber: form.accountNumber ? "" : "Required",
      accountName: form.accountName ? "" : "Required",
      bvn: form.bvn.length === 11 ? "" : "BVN must be 11 digits",
    },
    1: {
      idNumber: form.idNumber ? "" : "Required",
      idExpiryDate: form.idExpiryDate ? "" : "Required",
      secretQuestion: form.secretQuestion ? "" : "Required",
      secretAnswer: form.secretAnswer ? "" : "Required",
    },
    2: {
      nextOfKinName: form.nextOfKinName ? "" : "Required",
      nextOfKinRelationship: form.nextOfKinRelationship ? "" : "Required",
      nextOfKinPhone: form.nextOfKinPhone ? "" : "Required",
      nextOfKinAddress: form.nextOfKinAddress ? "" : "Required",
    },
  };

  const isStepValid = (s: number) => Object.values(stepErrors[s] ?? {}).every((e) => !e);
  const errFor = (key: string) => (touched[key] ? stepErrors[step]?.[key] : undefined);

  const handleNext = () => {
    const errs = stepErrors[step] ?? {};
    setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(errs).map((k) => [k, true])) }));
    if (isStepValid(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    if (!profile) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitKyc(profile.tenantId, profile.memberId, form, existing?.status === "REJECTED");
      setSubmitted(true);
      invalidateProfile();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (existing?.status === "PENDING" && !submitted) {
    return (
      <div className="py-16 text-center space-y-3">
        <ShieldCheck className="h-10 w-10 text-amber-500 mx-auto" />
        <p className="font-semibold text-foreground">Your KYC is under review</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Your cooperative admin is reviewing your submission. We'll notify you once it's approved.</p>
      </div>
    );
  }

  if (existing?.status === "APPROVED") {
    return (
      <div className="py-16 text-center space-y-3">
        <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
        <p className="font-semibold text-foreground">Your KYC is verified</p>
        <p className="text-sm text-muted-foreground">You're all set to withdraw from your investments.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
        <p className="font-semibold text-foreground">KYC submitted</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Your cooperative admin will review your details shortly.</p>
        <button onClick={() => navigate("/member")} className="text-primary text-sm font-semibold hover:underline">Back to Home</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {existing?.status === "REJECTED" ? "Update your KYC" : "Complete your KYC"}
        </h1>
        <p className="text-sm text-muted-foreground">Required before you can withdraw from any investment product.</p>
        {existing?.status === "REJECTED" && existing.rejectionReason && (
          <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{existing.rejectionReason}</p>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center gap-1.5">
            <div className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-3">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
        {step === 0 && (
          <>
            <Field label="Bank Name" value={form.bankName} onChange={set("bankName")} placeholder="e.g. GTBank" autoComplete="off" error={errFor("bankName")} />
            <Field label="Account Number" value={form.accountNumber} onChange={set("accountNumber")} placeholder="10-digit account number" autoComplete="off" error={errFor("accountNumber")} />
            <Field label="Account Name" value={form.accountName} onChange={set("accountName")} placeholder="As it appears on your bank account" autoComplete="name" error={errFor("accountName")} />
            <Field label="BVN" value={form.bvn} onChange={(v) => set("bvn")(v.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit BVN" error={errFor("bvn")} />
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">ID Type *</label>
              <select value={form.idType} onChange={(e) => set("idType")(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm">
                {(Object.keys(idTypeLabel) as KycIdType[]).map((t) => <option key={t} value={t}>{idTypeLabel[t]}</option>)}
              </select>
            </div>
            <Field label="ID Number" value={form.idNumber} onChange={set("idNumber")} placeholder="Document number" error={errFor("idNumber")} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Expiry Date *</label>
              <input type="date" value={form.idExpiryDate} onChange={(e) => set("idExpiryDate")(e.target.value)} className={`w-full h-11 px-3 rounded-lg border bg-background text-sm ${errFor("idExpiryDate") ? "border-red-300" : "border-input"}`} />
              {errFor("idExpiryDate") && <p className="text-xs text-red-600">{errFor("idExpiryDate")}</p>}
            </div>
            <Field label="Secret Question" value={form.secretQuestion} onChange={set("secretQuestion")} placeholder="e.g. What's your mother's maiden name?" error={errFor("secretQuestion")} />
            <Field label="Secret Answer" value={form.secretAnswer} onChange={set("secretAnswer")} placeholder="Your answer" error={errFor("secretAnswer")} />
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Full Name" value={form.nextOfKinName} onChange={set("nextOfKinName")} placeholder="Next of kin's full name" autoComplete="name" error={errFor("nextOfKinName")} />
            <Field label="Relationship" value={form.nextOfKinRelationship} onChange={set("nextOfKinRelationship")} placeholder="e.g. Spouse, Sibling, Parent" error={errFor("nextOfKinRelationship")} />
            <Field label="Phone Number" value={form.nextOfKinPhone} onChange={set("nextOfKinPhone")} placeholder="e.g. 08012345678" type="tel" autoComplete="tel" error={errFor("nextOfKinPhone")} />
            <Field label="Address" value={form.nextOfKinAddress} onChange={set("nextOfKinAddress")} placeholder="Full residential address" autoComplete="street-address" error={errFor("nextOfKinAddress")} />
          </>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bank Details</p>
              <p className="text-sm text-foreground">{form.bankName} · {form.accountNumber} · {form.accountName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identity Document</p>
              <p className="text-sm text-foreground">{idTypeLabel[form.idType]} · {form.idNumber} · Expires {new Date(form.idExpiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Next of Kin</p>
              <p className="text-sm text-foreground">{form.nextOfKinName} ({form.nextOfKinRelationship}) · {form.nextOfKinPhone}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={handleNext} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
            {submitting ? "Submitting…" : (<><Check className="h-4 w-4" /> Submit KYC</>)}
          </button>
        )}
      </div>
    </div>
  );
};

export default Kyc;
