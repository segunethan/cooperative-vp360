import { describe, it, expect } from "vitest";
import {
  REPORT_SCHEMAS, MEMBER_REGISTRY_ROW_SCHEMA, extractReportRows, formatCellForExport, columnsForExport,
} from "../reportSchemas";
import type { ReportType } from "../api/reports";

describe("extractReportRows — schema stability", () => {
  it("produces every defined column even when the source row is missing optional fields", () => {
    const result = { byChannel: [{ channel: "cash" }] }; // totalKobo/count absent
    const rows = extractReportRows("CONTRIBUTION_SUMMARY", result);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["channel", "count", "totalKobo"].sort());
    expect(rows[0].totalKobo).toBeNull();
    expect(rows[0].count).toBeNull();
  });

  it("does not leak unexpected fields that aren't part of the schema", () => {
    const result = { byStatus: [{ status: "ACTIVE", count: 5, principalKobo: 100, secretInternalField: "nope" }] };
    const rows = extractReportRows("LOAN_PORTFOLIO", result);
    expect(Object.keys(rows[0]).sort()).toEqual(["count", "principalKobo", "status"].sort());
    expect(rows[0]).not.toHaveProperty("secretInternalField");
  });

  it("returns columns in schema order regardless of source key order", () => {
    const result = { byStatus: [{ principalKobo: 100, status: "ACTIVE", count: 5 }] };
    const rows = extractReportRows("LOAN_PORTFOLIO", result);
    const orderedKeys = columnsForExport(REPORT_SCHEMAS.LOAN_PORTFOLIO.columns).map((c) => c.key);
    expect(Object.keys(rows[0])).toEqual(orderedKeys);
  });

  it("returns an empty array (not an error) for an empty dataset", () => {
    expect(extractReportRows("DIVIDEND_DISTRIBUTION", { dividends: [] })).toEqual([]);
    expect(extractReportRows("DIVIDEND_DISTRIBUTION", {})).toEqual([]);
  });

  it("wraps a rowsPath:null report (financial statement) as exactly one row", () => {
    const result = { periodYear: 2026, totalContributionsKobo: 52_900_000_000 };
    const rows = extractReportRows("FINANCIAL_STATEMENT", result);
    expect(rows).toHaveLength(1);
    expect(rows[0].periodYear).toBe(2026);
  });

  it("every report type has at least one column, and keys are unique", () => {
    (Object.keys(REPORT_SCHEMAS) as ReportType[]).forEach((type) => {
      const schema = REPORT_SCHEMAS[type];
      expect(schema.columns.length).toBeGreaterThan(0);
      const keys = schema.columns.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});

describe("formatCellForExport", () => {
  const moneyCol = { key: "totalKobo", label: "Total", type: "money" as const, nullable: false, order: 1 };
  const percentCol = { key: "ratePct", label: "Rate", type: "percent" as const, nullable: false, order: 1 };
  const boolCol = { key: "kycVerified", label: "KYC", type: "boolean" as const, nullable: false, order: 1 };
  const dateCol = { key: "joinedAt", label: "Joined", type: "date" as const, nullable: false, order: 1 };
  const stringCol = { key: "status", label: "Status", type: "string" as const, nullable: false, order: 1 };

  it("converts kobo to a plain naira decimal number (not a formatted string)", () => {
    expect(formatCellForExport(moneyCol, 100)).toBe(1);
    expect(formatCellForExport(moneyCol, 52_900_000_000)).toBe(529_000_000);
    expect(formatCellForExport(moneyCol, 71_250)).toBe(712.5);
    // must be a real number a spreadsheet can sum, never a "₦"-prefixed string
    expect(typeof formatCellForExport(moneyCol, 100)).toBe("number");
  });

  it("does not introduce float drift for exact kobo amounts", () => {
    // 529,000,000 naira exactly — a classic case where naive float division drifts
    expect(formatCellForExport(moneyCol, 52_900_000_000)).toBe(529_000_000);
  });

  it("passes percent through as a number", () => {
    expect(formatCellForExport(percentCol, 18)).toBe(18);
  });

  it("renders booleans as Yes/No", () => {
    expect(formatCellForExport(boolCol, true)).toBe("Yes");
    expect(formatCellForExport(boolCol, false)).toBe("No");
  });

  it("formats dates consistently", () => {
    expect(formatCellForExport(dateCol, "2026-03-05T00:00:00.000Z")).toMatch(/2026/);
  });

  it("renders null/undefined as an empty string, not the literal word null", () => {
    expect(formatCellForExport(stringCol, null)).toBe("");
    expect(formatCellForExport(stringCol, undefined)).toBe("");
  });

  it("passes strings through unchanged", () => {
    expect(formatCellForExport(stringCol, "ACTIVE")).toBe("ACTIVE");
  });
});

describe("MEMBER_REGISTRY_ROW_SCHEMA", () => {
  it("defines the full per-member export columns distinct from the summary schema", () => {
    const keys = MEMBER_REGISTRY_ROW_SCHEMA.map((c) => c.key);
    expect(keys).toEqual(["memberNumber", "fullName", "email", "phone", "status", "kycVerified", "joinedAt"]);
  });

  it("marks email/phone nullable and the rest required", () => {
    const required = MEMBER_REGISTRY_ROW_SCHEMA.filter((c) => !c.nullable).map((c) => c.key);
    expect(required).toEqual(["memberNumber", "fullName", "status", "kycVerified", "joinedAt"]);
  });
});
