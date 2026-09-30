// Admin per-member payroll/dues ledger — reads member_dues directly via
// Supabase (RLS already scopes this to the admin's own tenant through the
// member_dues_isolated policy), keyset-paginated on (period_year,
// period_month, id) so a long-tenured member's history never means an
// offset scan.
import { supabase } from "../supabase";
import { handleSupabaseError } from "../errors";

export interface MemberDueRow {
  id: string;
  due_type: "CONTRIBUTION" | "LOAN_INSTALLMENT";
  period_month: number;
  period_year: number;
  amount_due_kobo: number;
  deduction_method: "CASH" | "BANK_TRANSFER" | "PAYROLL";
  status: "OPEN" | "FULFILLED" | "PARTIAL" | "WAIVED";
  fulfilled_amount_kobo: number;
  contribution: { id: string; paid_at: string | null; channel: string } | null;
  loan_repayment: { id: string; paid_at: string; channel: string } | null;
}

export interface MemberLedgerPage {
  dues: MemberDueRow[];
  nextCursor: string | null; // "<period_year>:<period_month>:<id>"
}

function parseCursor(raw: string | undefined) {
  if (!raw) return null;
  const [year, month, id] = raw.split(":");
  if (!year || !month || !id) return null;
  return { year: parseInt(year), month: parseInt(month), id };
}

export const fetchMemberLedger = async (memberId: string, cursor?: string, pageSize = 50): Promise<MemberLedgerPage> => {
  const parsed = parseCursor(cursor);

  let query = supabase
    .from("member_dues")
    .select(
      `id, due_type, period_month, period_year, amount_due_kobo, deduction_method,
       status, fulfilled_amount_kobo,
       contribution:contributions(id, paid_at:completed_at, channel),
       loan_repayment:loan_repayments(id, paid_at, channel)`
    )
    .eq("member_id", memberId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize);

  if (parsed) {
    query = query.or(
      `period_year.lt.${parsed.year},` +
        `and(period_year.eq.${parsed.year},period_month.lt.${parsed.month}),` +
        `and(period_year.eq.${parsed.year},period_month.eq.${parsed.month},id.lt.${parsed.id})`
    );
  }

  const { data, error } = await query;
  if (error) handleSupabaseError(error);

  const dues = (data ?? []) as unknown as MemberDueRow[];
  const last = dues[dues.length - 1];
  const nextCursor = dues.length === pageSize && last ? `${last.period_year}:${last.period_month}:${last.id}` : null;

  return { dues, nextCursor };
};
