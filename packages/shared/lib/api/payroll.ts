// Payroll deductions — entirely Supabase-native (Postgres functions + RLS +
// the same supabase-js client pattern as every other module in this
// directory). The heavy lifting (batch generation, dues generation) runs as
// set-based SQL inside generate_member_dues()/generate_payroll_batch() in
// supabase/migrations/20260930000000_payroll_deductions.sql, so there's no
// external service and nothing to deploy beyond the migration itself.
import Papa from "papaparse";
import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";
import { koboToNaira, nairaToKobo } from "../money";

export interface PayrollBatch {
  id: string;
  period_month: number;
  period_year: number;
  status: "DRAFT" | "LOCKED" | "EXPORTED" | "RECONCILED";
  member_count: number;
  total_amount_kobo: number;
  generated_at: string;
  locked_at: string | null;
  exported_at: string | null;
}

export interface PayrollBatchItem {
  id: string;
  member_id: string;
  staff_id: string | null;
  contribution_amount_kobo: number;
  loan_installment_amount_kobo: number;
  total_amount_kobo: number;
  status: "PENDING" | "DEDUCTED" | "PARTIAL" | "NOT_DEDUCTED";
  member: { member_number: string; full_name: string } | null;
}

export const generatePayrollDues = async (periodMonth: number, periodYear: number): Promise<number> => {
  const { data, error } = await supabase.rpc("generate_member_dues", {
    p_period_month: periodMonth,
    p_period_year: periodYear,
  });
  if (error) handleSupabaseError(error);
  return (data as number) ?? 0;
};

export const createPayrollBatch = async (periodMonth: number, periodYear: number): Promise<PayrollBatch> => {
  const { data, error } = await supabase
    .rpc("generate_payroll_batch", { p_period_month: periodMonth, p_period_year: periodYear })
    .single();
  if (error) handleSupabaseError(error);
  const row = data as { id: string; period_month: number; period_year: number; status: string; member_count: number; total_amount_kobo: number };
  return {
    id: row.id,
    period_month: row.period_month,
    period_year: row.period_year,
    status: row.status as PayrollBatch["status"],
    member_count: row.member_count,
    total_amount_kobo: row.total_amount_kobo,
    generated_at: new Date().toISOString(),
    locked_at: null,
    exported_at: null,
  };
};

export const fetchPayrollBatches = async (page = 1, pageSize = 20): Promise<PayrollBatch[]> => {
  const offset = (page - 1) * pageSize;
  const { data, error } = await supabase
    .from("payroll_batches")
    .select("id, period_month, period_year, status, member_count, total_amount_kobo, generated_at, locked_at, exported_at")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (error) handleSupabaseError(error);
  return (data ?? []) as PayrollBatch[];
};

// Keyset (id) pagination — batch size is naturally bounded by how many
// PAYROLL-deduction members the cooperative has, but this avoids the
// offset-pagination anti-pattern regardless of scale.
export const fetchPayrollBatchItems = async (
  batchId: string,
  cursor?: string,
  pageSize = 50
): Promise<{ items: PayrollBatchItem[]; nextCursor: string | null }> => {
  let query = supabase
    .from("payroll_batch_items")
    .select("id, member_id, staff_id, contribution_amount_kobo, loan_installment_amount_kobo, total_amount_kobo, status, member:members(member_number, full_name)")
    .eq("batch_id", batchId)
    .order("id", { ascending: true })
    .limit(pageSize);

  if (cursor) query = query.gt("id", cursor);

  const { data, error } = await query;
  if (error) handleSupabaseError(error);

  const items = (data ?? []) as unknown as PayrollBatchItem[];
  const nextCursor = items.length === pageSize ? items[items.length - 1].id : null;
  return { items, nextCursor };
};

export const lockPayrollBatch = async (batchId: string): Promise<{ id: string; status: string }> => {
  const { data, error } = await supabase
    .from("payroll_batches")
    .update({ status: "LOCKED", locked_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("status", "DRAFT")
    .select("id, status")
    .single();
  if (error) handleSupabaseError(error);
  return data as { id: string; status: string };
};

export const reconcilePayrollItem = async (
  itemId: string,
  status: "DEDUCTED" | "PARTIAL" | "NOT_DEDUCTED",
  deductedAmountNaira?: number
): Promise<void> => {
  const { error } = await supabase.rpc("reconcile_payroll_item", {
    p_item_id: itemId,
    p_status: status,
    p_deducted_amount_kobo: status === "NOT_DEDUCTED" ? 0 : nairaToKobo(deductedAmountNaira ?? 0),
  });
  if (error) handleSupabaseError(error);
};

// Fetches every item in the batch (paginated under the hood) and builds the
// CSV client-side with Papa.unparse — the same library and Blob/<a download>
// pattern already used for member CSV import/export elsewhere in the admin
// app (see BulkImportDialog.tsx). A payroll batch tops out at however many
// PAYROLL-deduction members the cooperative has, which comfortably fits in
// browser memory even at several thousand rows.
export const downloadPayrollBatchCsv = async (batchId: string, filenameHint: string): Promise<void> => {
  const rows: Record<string, string>[] = [];
  let cursor: string | undefined;

  while (true) {
    const { items, nextCursor } = await fetchPayrollBatchItems(batchId, cursor, 500);
    for (const item of items) {
      rows.push({
        "Staff ID": item.staff_id ?? "",
        "Member Name": item.member?.full_name ?? "",
        "Contribution (NGN)": koboToNaira(item.contribution_amount_kobo).toFixed(2),
        "Loan Installment (NGN)": koboToNaira(item.loan_installment_amount_kobo).toFixed(2),
        "Total (NGN)": koboToNaira(item.total_amount_kobo).toFixed(2),
      });
    }
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameHint;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  await supabase.from("payroll_batches").update({ exported_at: new Date().toISOString(), status: "EXPORTED" }).eq("id", batchId).eq("status", "LOCKED");
};

export const formatPayrollAmount = (kobo: number) =>
  `₦${koboToNaira(kobo).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
