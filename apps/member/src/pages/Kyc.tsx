import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useMemberProfile, useInvalidateMemberProfile } from "@/hooks/useMemberProfile";
import { submitKyc, fetchOwnKyc, type KycFormData, type KycIdType } from "@jollify/shared/lib/api/kyc";
import { fetchMembershipSettings } from "@jollify/shared/lib/api/settings";
import { formatMoneyFull, nairaToKobo, generatePaymentReference } from "@jollify/shared/lib/money";
import { supabase } from "@jollify/shared/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import Stepper from "@/components/Stepper";

const STEPS = ["Identity & Bank Details", "Declarations & Next of Kin", "Entrance Fee & Thrift", "Review & Sign"];

const EMPTY_FORM: KycFormData = {
  bankName: "", accountNumber: "", accountName: "", bvn: "", nin: "",
  secretQuestion: "", secretAnswer: "",
  idType: "NIN", idNumber: "", idExpiryDate: "", idDocumentUrl: undefined,
  notInOtherSociety: false, existingDebtDeclaration: "",
  nextOfKinName: "", nextOfKinRelationship: "", nextOfKinPhone: "", nextOfKinAddress: "",
  monthlyThriftKobo: undefined, entranceFeeKobo: undefined, entranceFeeReceiptUrl: undefined, entranceFeePaidDate: undefined,
  signatureName: "",
};

const idTypeLabel: Record<KycIdType, string> = {
  NIN: "National ID (NIN)",
  PASSPORT: "International Passport",
  DRIVERS_LICENSE: "Driver's License",
  VOTERS_CARD: "Voter's Card",
};

const Field = ({
  label, value, onChange, placeholder, type = "text", autoComplete, error, required = true,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string; error?: string; required?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label}{required && " *"}</label>
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

const uploadDocument = async (tenantId: string, prefix: string, file: File): Promise<string | null> => {
  const ext = file.name.split(".").pop() ?? "bin";
  const ref = generatePaymentReference(prefix);
  const path = `${tenantId}/${ref}.${ext}`;
  const { data, error } = await supabase.storage.from("contribution-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from("contribution-receipts").getPublicUrl(data.path);
  return urlData.publicUrl;
};

const Kyc = () => {
  const navigate = useNavigate();
  const { data: profile } = useMemberProfile();
  const invalidateProfile = useInvalidateMemberProfile();

  const { data: existing } = useQuery({
    queryKey: ["own-kyc", profile?.memberId],
    queryFn: () => fetchOwnKyc(profile!.memberId),
    enabled: !!profile,
  });

  const { data: membershipSettings } = useQuery({
    queryKey: ["membership-settings", profile?.tenantId],
    queryFn: () => fetchMembershipSettings(profile!.tenantId),
    enabled: !!profile,
  });
  const entranceFeeKobo = membershipSettings?.entranceFeeKobo ?? null;
  const bankAccountInfo = membershipSettings?.bankAccountInfo ?? null;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<KycFormData>(EMPTY_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [feeReceiptFile, setFeeReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thriftNaira, setThriftNaira] = useState(form.monthlyThriftKobo ? String(form.monthlyThriftKobo / 100) : "");
  const [feePaidDate, setFeePaidDate] = useState(form.entranceFeePaidDate ?? new Date().toISOString().split("T")[0]);

  // Mobile browsers frequently reload the page after the app is backgrounded
  // (memory pressure eviction, not something we control) — auto-save a draft
  // so a minimize mid-form doesn't wipe out everything typed so far.
  const draftKey = profile ? `kyc-draft-${profile.memberId}` : null;

  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.form) setForm(draft.form);
        if (typeof draft.step === "number") setStep(draft.step);
        if (typeof draft.thriftNaira === "string") setThriftNaira(draft.thriftNaira);
        if (typeof draft.feePaidDate === "string") setFeePaidDate(draft.feePaidDate);
      }
    } catch {
      // corrupted draft — ignore, start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || submitted) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, step, thriftNaira, feePaidDate }));
    } catch {
      // storage full/unavailable — draft saving is best-effort only
    }
  });

  useEffect(() => {
    if (existing && (existing.status === "REJECTED" || existing.status === "PENDING")) {
      setForm({
        bankName: existing.bankName, accountNumber: existing.accountNumber, accountName: existing.accountName,
        bvn: existing.bvn, nin: existing.nin,
        secretQuestion: existing.secretQuestion, secretAnswer: existing.secretAnswer,
        idType: existing.idType, idNumber: existing.idNumber, idExpiryDate: existing.idExpiryDate, idDocumentUrl: existing.idDocumentUrl ?? undefined,
        notInOtherSociety: existing.notInOtherSociety, existingDebtDeclaration: existing.existingDebtDeclaration,
        nextOfKinName: existing.nextOfKinName, nextOfKinRelationship: existing.nextOfKinRelationship,
        nextOfKinPhone: existing.nextOfKinPhone, nextOfKinAddress: existing.nextOfKinAddress,
        monthlyThriftKobo: existing.monthlyThriftKobo ?? undefined,
        entranceFeeKobo: existing.entranceFeeKobo ?? undefined,
        entranceFeeReceiptUrl: existing.entranceFeeReceiptUrl ?? undefined,
        entranceFeePaidDate: existing.entranceFeePaidDate ?? undefined,
        signatureName: existing.signatureName,
      });
    }
  }, [existing]);

  const set = <K extends keyof KycFormData>(key: K) => (value: KycFormData[K]) => setForm((f) => ({ ...f, [key]: value }));
  const markTouched = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const feeRequired = !!entranceFeeKobo && entranceFeeKobo > 0;

  const stepErrors: Record<number, Record<string, string>> = {
    0: {
      bankName: form.bankName ? "" : "Required",
      accountNumber: form.accountNumber ? "" : "Required",
      accountName: form.accountName ? "" : "Required",
      bvn: form.bvn.length === 11 ? "" : "BVN must be 11 digits",
      nin: form.nin.length === 11 ? "" : "NIN must be 11 digits",
      idNumber: form.idNumber ? "" : "Required",
      idExpiryDate: form.idExpiryDate ? "" : "Required",
      secretQuestion: form.secretQuestion ? "" : "Required",
      secretAnswer: form.secretAnswer ? "" : "Required",
    },
    1: {
      notInOtherSociety: form.notInOtherSociety ? "" : "You must confirm this to continue",
      nextOfKinName: form.nextOfKinName ? "" : "Required",
      nextOfKinRelationship: form.nextOfKinRelationship ? "" : "Required",
      nextOfKinPhone: form.nextOfKinPhone ? "" : "Required",
      nextOfKinAddress: form.nextOfKinAddress ? "" : "Required",
    },
    2: {
      thriftNaira: thriftNaira && parseFloat(thriftNaira) > 0 ? "" : "Enter your monthly thrift commitment",
      feeReceipt: feeRequired && !feeReceiptFile && !form.entranceFeeReceiptUrl ? "Upload your entrance fee receipt" : "",
    },
    3: {
      signatureName: form.signatureName ? "" : "Type your full name to sign",
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
      let idDocumentUrl = form.idDocumentUrl;
      if (idDocFile) {
        idDocumentUrl = (await uploadDocument(profile.tenantId, "IDDOC", idDocFile)) ?? undefined;
      }
      let entranceFeeReceiptUrl = form.entranceFeeReceiptUrl;
      if (feeReceiptFile) {
        entranceFeeReceiptUrl = (await uploadDocument(profile.tenantId, "ENTFEE", feeReceiptFile)) ?? undefined;
      }

      await submitKyc(profile.tenantId, profile.memberId, {
        ...form,
        idDocumentUrl,
        monthlyThriftKobo: nairaToKobo(parseFloat(thriftNaira)),
        entranceFeeKobo: feeRequired ? entranceFeeKobo! : undefined,
        entranceFeeReceiptUrl: feeRequired ? entranceFeeReceiptUrl : undefined,
        entranceFeePaidDate: feeRequired ? feePaidDate : undefined,
      }, existing?.status === "REJECTED");
      setSubmitted(true);
      if (draftKey) localStorage.removeItem(draftKey);
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
        <p className="font-semibold text-foreground">Your membership onboarding is under review</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Your cooperative admin is reviewing your submission. We'll notify you once it's approved.</p>
      </div>
    );
  }

  if (existing?.status === "APPROVED") {
    const fmtDate = (d: string | null) =>
      d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const Info = ({ label, value }: { label: string; value: string }) => (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    );
    return (
      <div className="space-y-5">
        <div className="text-center space-y-2 py-4">
          <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
          <p className="font-semibold text-foreground">You're a fully onboarded member</p>
          <p className="text-sm text-muted-foreground">You have full access to products, loans, and contributions.</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Submitted {fmtDate(existing.submittedAt)}</span>
            {existing.reviewedAt && <span>· Approved {fmtDate(existing.reviewedAt)}</span>}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bank Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Info label="Bank Name" value={existing.bankName} />
              <Info label="Account Number" value={existing.accountNumber} />
              <Info label="Account Name" value={existing.accountName} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <Info label="ID Type" value={idTypeLabel[existing.idType] ?? existing.idType} />
              <Info label="ID Number" value={existing.idNumber} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Next of Kin</p>
            <div className="grid grid-cols-2 gap-3">
              <Info label="Full Name" value={existing.nextOfKinName} />
              <Info label="Relationship" value={existing.nextOfKinRelationship} />
              <Info label="Phone" value={existing.nextOfKinPhone} />
              <Info label="Address" value={existing.nextOfKinAddress} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Entrance Fee & Thrift</p>
            <div className="grid grid-cols-2 gap-3">
              <Info label="Entrance Fee" value={existing.entranceFeeKobo ? formatMoneyFull(existing.entranceFeeKobo) : "Not required"} />
              <Info label="Monthly Thrift Commitment" value={existing.monthlyThriftKobo ? formatMoneyFull(existing.monthlyThriftKobo) : "—"} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="py-16 text-center space-y-4">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
        <p className="font-semibold text-foreground">Membership onboarding submitted</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Your cooperative admin will review your details shortly.</p>
        <button onClick={() => navigate("/member")} className="text-primary text-sm font-semibold hover:underline">Back to Home</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {existing?.status === "REJECTED" ? "Update your membership onboarding" : "Complete your membership onboarding"}
        </h1>
        <p className="text-sm text-muted-foreground">Required before you can subscribe, contribute, or apply for a loan.</p>
        {existing?.status === "REJECTED" && existing.rejectionReason && (
          <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{existing.rejectionReason}</p>
        )}
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
        {step === 0 && (
          <>
            <Field label="Bank Name" value={form.bankName} onChange={set("bankName")} placeholder="e.g. GTBank" autoComplete="off" error={errFor("bankName")} />
            <Field label="Account Number" value={form.accountNumber} onChange={set("accountNumber")} placeholder="10-digit account number" autoComplete="off" error={errFor("accountNumber")} />
            <Field label="Account Name" value={form.accountName} onChange={set("accountName")} placeholder="As it appears on your bank account" autoComplete="name" error={errFor("accountName")} />
            <Field label="BVN" value={form.bvn} onChange={(v) => set("bvn")(v.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit BVN" error={errFor("bvn")} />
            <Field label="NIN" value={form.nin} onChange={(v) => set("nin")(v.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit National ID Number" error={errFor("nin")} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">ID Type *</label>
              <select value={form.idType} onChange={(e) => set("idType")(e.target.value as KycIdType)} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm">
                {(Object.keys(idTypeLabel) as KycIdType[]).map((t) => <option key={t} value={t}>{idTypeLabel[t]}</option>)}
              </select>
            </div>
            <Field label="ID Number" value={form.idNumber} onChange={set("idNumber")} placeholder="Document number" error={errFor("idNumber")} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Expiry Date *</label>
              <input type="date" value={form.idExpiryDate} onChange={(e) => set("idExpiryDate")(e.target.value)} className={`w-full h-11 px-3 rounded-lg border bg-background text-sm ${errFor("idExpiryDate") ? "border-red-300" : "border-input"}`} />
              {errFor("idExpiryDate") && <p className="text-xs text-red-600">{errFor("idExpiryDate")}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Upload ID Document <span className="text-muted-foreground font-normal">(optional)</span></label>
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/4 transition-colors">
                <span className="text-xs font-medium text-muted-foreground px-4 text-center">{idDocFile ? idDocFile.name : form.idDocumentUrl ? "Document on file — tap to replace" : "Photo or scan of your ID"}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setIdDocFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <Field label="Secret Question" value={form.secretQuestion} onChange={set("secretQuestion")} placeholder="e.g. What's your mother's maiden name?" error={errFor("secretQuestion")} />
            <Field label="Secret Answer" value={form.secretAnswer} onChange={set("secretAnswer")} placeholder="Your answer" error={errFor("secretAnswer")} />
          </>
        )}

        {step === 1 && (
          <>
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border cursor-pointer">
              <input type="checkbox" checked={form.notInOtherSociety} onChange={(e) => set("notInOtherSociety")(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
              <span className="text-sm text-foreground">I confirm I do not belong to another cooperative society with identical objectives.</span>
            </label>
            {errFor("notInOtherSociety") && <p className="text-xs text-red-600">{errFor("notInOtherSociety")}</p>}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Existing Debt Declaration <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                value={form.existingDebtDeclaration} onChange={(e) => set("existingDebtDeclaration")(e.target.value)}
                placeholder="Declare any existing debt to another society or institution, or leave blank if none."
                rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
            </div>

            <div className="pt-2 border-t border-border" />
            <Field label="Next of Kin — Full Name" value={form.nextOfKinName} onChange={set("nextOfKinName")} placeholder="Next of kin's full name" autoComplete="name" error={errFor("nextOfKinName")} />
            <Field label="Relationship" value={form.nextOfKinRelationship} onChange={set("nextOfKinRelationship")} placeholder="e.g. Spouse, Sibling, Parent" error={errFor("nextOfKinRelationship")} />
            <Field label="Phone Number" value={form.nextOfKinPhone} onChange={set("nextOfKinPhone")} placeholder="e.g. 08012345678" type="tel" autoComplete="tel" error={errFor("nextOfKinPhone")} />
            <Field label="Address" value={form.nextOfKinAddress} onChange={set("nextOfKinAddress")} placeholder="Full residential address" autoComplete="street-address" error={errFor("nextOfKinAddress")} />
          </>
        )}

        {step === 2 && (
          <>
            {feeRequired ? (
              <>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">Entrance Fee (Non-Refundable)</p>
                  <p className="text-lg font-bold text-emerald-800">{formatMoneyFull(entranceFeeKobo!)}</p>
                </div>
                {bankAccountInfo ? (
                  <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pay Into</p>
                    <p className="text-sm text-foreground whitespace-pre-line">{bankAccountInfo}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                    Your cooperative hasn't set up a payment account yet. Contact your admin before paying.
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Date Paid *</label>
                  <input type="date" max={new Date().toISOString().split("T")[0]} value={feePaidDate} onChange={(e) => setFeePaidDate(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Entrance Fee Receipt *</label>
                  <label className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/4 transition-colors ${errFor("feeReceipt") ? "border-red-300" : "border-border"}`}>
                    <span className="text-xs font-medium text-muted-foreground px-4 text-center">{feeReceiptFile ? feeReceiptFile.name : form.entranceFeeReceiptUrl ? "Receipt on file — tap to replace" : "Upload transfer receipt"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFeeReceiptFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {errFor("feeReceipt") && <p className="text-xs text-red-600">{errFor("feeReceipt")}</p>}
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm text-muted-foreground">
                No entrance fee has been set by your cooperative — nothing due here.
              </div>
            )}

            <div className="pt-2 border-t border-border space-y-1.5">
              <label className="text-sm font-medium text-foreground">Monthly Thrift Savings Commitment (₦) *</label>
              <input type="number" min={1} placeholder="e.g. 10000" value={thriftNaira} onChange={(e) => setThriftNaira(e.target.value)} className={`w-full h-11 px-3 rounded-lg border bg-background text-sm ${errFor("thriftNaira") ? "border-red-300" : "border-input"}`} />
              {errFor("thriftNaira") && <p className="text-xs text-red-600">{errFor("thriftNaira")}</p>}
              <p className="text-xs text-muted-foreground">How much you commit to saving with the cooperative each month.</p>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bank Details</p>
              <p className="text-sm text-foreground">{form.bankName} · {form.accountNumber} · {form.accountName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identity</p>
              <p className="text-sm text-foreground">NIN {form.nin} · {idTypeLabel[form.idType]} {form.idNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Next of Kin</p>
              <p className="text-sm text-foreground">{form.nextOfKinName} ({form.nextOfKinRelationship}) · {form.nextOfKinPhone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Thrift Commitment</p>
              <p className="text-sm text-foreground">{thriftNaira ? formatMoneyFull(nairaToKobo(parseFloat(thriftNaira))) : "—"} / month</p>
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <Field label="Type your full name to sign" value={form.signatureName} onChange={set("signatureName")} placeholder="Your full legal name" error={errFor("signatureName")} />
              <p className="text-xs text-muted-foreground">By typing your name above and submitting, you hereby endorse your entry into the Membership Register and confirm the information provided is accurate.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="flex-1 h-11 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={handleNext} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Next
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || !form.signatureName} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {submitting ? "Submitting…" : "Sign & Submit"}
          </button>
        )}
      </div>
    </div>
  );
};

export default Kyc;
