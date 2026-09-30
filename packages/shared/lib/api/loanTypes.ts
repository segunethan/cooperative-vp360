import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export type LoanTypeStatus = "ACTIVE" | "ARCHIVED";

export interface LoanType {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  interestRateBps: number;
  interestRatePercent: number;
  tenureMonths: number;
  status: LoanTypeStatus;
}

const toLoanType = (row: Record<string, unknown>): LoanType => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  name: row.name as string,
  description: (row.description as string) ?? null,
  interestRateBps: row.interest_rate_bps as number,
  interestRatePercent: (row.interest_rate_bps as number) / 100,
  tenureMonths: row.tenure_months as number,
  status: row.status as LoanTypeStatus,
});

// ── Reads ────────────────────────────────────────────────────────────────────

// Admin: every loan type regardless of status, for the configuration screen.
export const fetchAllLoanTypes = async (): Promise<LoanType[]> => {
  const { data, error } = await supabase
    .from("loan_types")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toLoanType);
};

// Member/application dialogs: only what's currently offered.
export const fetchActiveLoanTypes = async (): Promise<LoanType[]> => {
  const { data, error } = await supabase
    .from("loan_types")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true });
  if (error) handleSupabaseError(error);
  return (data ?? []).map(toLoanType);
};

// ── Writes ───────────────────────────────────────────────────────────────────

export interface LoanTypeFormData {
  name: string;
  description?: string;
  interestRatePercent: number;
  tenureMonths: number;
  status: LoanTypeStatus;
}

export const createLoanType = async (tenantId: string, data: LoanTypeFormData): Promise<void> => {
  const { error } = await supabase.from("loan_types").insert({
    tenant_id: tenantId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    interest_rate_bps: Math.round(data.interestRatePercent * 100),
    tenure_months: data.tenureMonths,
    status: data.status,
  });
  if (error) handleSupabaseError(error);
};

export const updateLoanType = async (loanTypeId: string, data: LoanTypeFormData): Promise<void> => {
  const { error } = await supabase
    .from("loan_types")
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      interest_rate_bps: Math.round(data.interestRatePercent * 100),
      tenure_months: data.tenureMonths,
      status: data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loanTypeId);
  if (error) handleSupabaseError(error);
};

export const archiveLoanType = async (loanTypeId: string): Promise<void> => {
  const { error } = await supabase.from("loan_types").update({ status: "ARCHIVED" }).eq("id", loanTypeId);
  if (error) handleSupabaseError(error);
};
