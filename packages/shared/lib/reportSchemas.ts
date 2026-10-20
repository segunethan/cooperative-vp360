// Explicit, versioned column schemas for every report type — the single
// source of truth consumed by both the admin UI (table headers, detail
// view) and CSV export. Column name, order, and type live here once;
// nothing downstream infers columns from whatever keys happen to be
// present on a given row, so a report with a null/missing optional field
// still produces the exact same column set as one that doesn't.
import type { ReportType } from "./api/reports";
import { koboToNaira } from "./money";

export type ColumnType = "string" | "integer" | "decimal" | "money" | "percent" | "date" | "boolean";

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
  nullable: boolean;
  order: number;
}

export interface ReportSchema {
  reportType: ReportType;
  version: 1;
  /** Path to the array of detail rows inside the builder's jsonb result, or
   *  null when the whole result is itself exactly one row (e.g. a yearly
   *  statement that isn't naturally a list of anything). */
  rowsPath: string | null;
  columns: ReportColumn[];
}

export const REPORT_SCHEMAS: Record<ReportType, ReportSchema> = {
  CONTRIBUTION_SUMMARY: {
    reportType: "CONTRIBUTION_SUMMARY",
    version: 1,
    rowsPath: "byChannel",
    columns: [
      { key: "channel", label: "Channel", type: "string", nullable: false, order: 1 },
      { key: "count", label: "Contributions", type: "integer", nullable: false, order: 2 },
      { key: "totalKobo", label: "Total", type: "money", nullable: false, order: 3 },
    ],
  },
  LOAN_PORTFOLIO: {
    reportType: "LOAN_PORTFOLIO",
    version: 1,
    rowsPath: "byStatus",
    columns: [
      { key: "status", label: "Status", type: "string", nullable: false, order: 1 },
      { key: "count", label: "Loans", type: "integer", nullable: false, order: 2 },
      { key: "principalKobo", label: "Principal", type: "money", nullable: false, order: 3 },
    ],
  },
  MEMBER_REGISTRY: {
    reportType: "MEMBER_REGISTRY",
    version: 1,
    rowsPath: "byStatus",
    columns: [
      { key: "status", label: "Status", type: "string", nullable: false, order: 1 },
      { key: "count", label: "Members", type: "integer", nullable: false, order: 2 },
    ],
  },
  DIVIDEND_DISTRIBUTION: {
    reportType: "DIVIDEND_DISTRIBUTION",
    version: 1,
    rowsPath: "dividends",
    columns: [
      { key: "period", label: "Period", type: "string", nullable: false, order: 1 },
      { key: "ratePct", label: "Rate", type: "percent", nullable: false, order: 2 },
      { key: "status", label: "Status", type: "string", nullable: false, order: 3 },
      { key: "eligibleMembers", label: "Eligible Members", type: "integer", nullable: false, order: 4 },
      { key: "paidCount", label: "Paid", type: "integer", nullable: false, order: 5 },
      { key: "totalAmountKobo", label: "Total Amount", type: "money", nullable: false, order: 6 },
    ],
  },
  FINANCIAL_STATEMENT: {
    reportType: "FINANCIAL_STATEMENT",
    version: 1,
    rowsPath: null,
    columns: [
      { key: "periodYear", label: "Year", type: "integer", nullable: false, order: 1 },
      { key: "totalContributionsKobo", label: "Contributions", type: "money", nullable: false, order: 2 },
      { key: "totalLoansDisbursedKobo", label: "Loans Disbursed", type: "money", nullable: false, order: 3 },
      { key: "totalRepaymentsReceivedKobo", label: "Repayments Received", type: "money", nullable: false, order: 4 },
      { key: "totalDividendsPaidKobo", label: "Dividends Paid", type: "money", nullable: false, order: 5 },
      { key: "outstandingLoanPrincipalKobo", label: "Outstanding Principal", type: "money", nullable: false, order: 6 },
    ],
  },
};

// A dedicated row-level schema for the full member list — the one report
// whose natural size scales with tenant size (hundreds to 10,000+ rows),
// so it's exported via direct keyset-paginated reads rather than through
// the aggregate job-queue result (see fetchMemberRegistryPage in reports.ts).
export const MEMBER_REGISTRY_ROW_SCHEMA: ReportColumn[] = [
  { key: "memberNumber", label: "Member Number", type: "string", nullable: false, order: 1 },
  { key: "fullName", label: "Full Name", type: "string", nullable: false, order: 2 },
  { key: "email", label: "Email", type: "string", nullable: true, order: 3 },
  { key: "phone", label: "Phone", type: "string", nullable: true, order: 4 },
  { key: "status", label: "Status", type: "string", nullable: false, order: 5 },
  { key: "kycVerified", label: "KYC Verified", type: "boolean", nullable: false, order: 6 },
  { key: "joinedAt", label: "Joined", type: "date", nullable: false, order: 7 },
];

const getByPath = (obj: any, path: string | null): any[] => {
  if (path === null) return [obj];
  const value = obj?.[path];
  return Array.isArray(value) ? value : [];
};

/** Schema-ordered, schema-typed rows for a completed report's jsonb result
 *  — every row has exactly the columns the schema defines, in the defined
 *  order, regardless of which optional fields happen to be present. */
export const extractReportRows = (reportType: ReportType, result: Record<string, unknown>): Record<string, unknown>[] => {
  const schema = REPORT_SCHEMAS[reportType];
  const rawRows = getByPath(result, schema.rowsPath);
  const sortedColumns = [...schema.columns].sort((a, b) => a.order - b.order);
  return rawRows.map((raw) => {
    const row: Record<string, unknown> = {};
    for (const col of sortedColumns) {
      row[col.key] = raw?.[col.key] ?? null;
    }
    return row;
  });
};

/** Export-safe cell value: money becomes a plain naira decimal (a real
 *  number for spreadsheets, not a "₦"-prefixed display string), percent
 *  stays a plain number, booleans/strings pass through, nulls become "". */
export const formatCellForExport = (column: ReportColumn, value: unknown): string | number => {
  if (value === null || value === undefined) return "";
  switch (column.type) {
    case "money":
      return Number(koboToNaira(value as number).toFixed(2));
    case "percent":
      return Number(value);
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return new Date(value as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    default:
      return value as string | number;
  }
};

export const columnsForExport = (columns: ReportColumn[]) => [...columns].sort((a, b) => a.order - b.order);
