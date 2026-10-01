import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export type LoanTypeStatus = "ACTIVE" | "ARCHIVED";
export type LoanInterestMethod = "REDUCING_BALANCE" | "FLAT";
export type LoanPrepaymentStrategy = "REDUCE_TENURE" | "REDUCE_INSTALLMENT" | "ADVANCE_PAYMENT";

export interface LoanType {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  interestRateBps: number;
  interestRatePercent: number;
  tenureMonths: number;
  status: LoanTypeStatus;
  interestMethod: LoanInterestMethod;
  prepaymentStrategy: LoanPrepaymentStrategy;
  latePenaltyPercentPerMonth: number | null;
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
  interestMethod: row.interest_method as LoanInterestMethod,
  prepaymentStrategy: row.prepayment_strategy as LoanPrepaymentStrategy,
  latePenaltyPercentPerMonth: row.late_penalty_bps_per_month != null ? (row.late_penalty_bps_per_month as number) / 100 : null,
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
  interestMethod: LoanInterestMethod;
  prepaymentStrategy: LoanPrepaymentStrategy;
  latePenaltyPercentPerMonth?: number | null;
}

export const createLoanType = async (tenantId: string, data: LoanTypeFormData): Promise<void> => {
  const { error } = await supabase.from("loan_types").insert({
    tenant_id: tenantId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    interest_rate_bps: Math.round(data.interestRatePercent * 100),
    tenure_months: data.tenureMonths,
    status: data.status,
    interest_method: data.interestMethod,
    prepayment_strategy: data.prepaymentStrategy,
    late_penalty_bps_per_month: data.latePenaltyPercentPerMonth ? Math.round(data.latePenaltyPercentPerMonth * 100) : null,
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
      interest_method: data.interestMethod,
      prepayment_strategy: data.prepaymentStrategy,
      late_penalty_bps_per_month: data.latePenaltyPercentPerMonth ? Math.round(data.latePenaltyPercentPerMonth * 100) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loanTypeId);
  if (error) handleSupabaseError(error);
};

export const archiveLoanType = async (loanTypeId: string): Promise<void> => {
  const { error } = await supabase.from("loan_types").update({ status: "ARCHIVED" }).eq("id", loanTypeId);
  if (error) handleSupabaseError(error);
};
