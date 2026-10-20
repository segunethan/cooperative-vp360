import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from "../supabase";
import { sanitizeCsvCell, fetchMemberRegistryPage, requestReport } from "../api/reports";

describe("sanitizeCsvCell — CSV formula-injection protection", () => {
  it("neutralizes values that would be read as a formula by Excel/Sheets", () => {
    expect(sanitizeCsvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(sanitizeCsvCell("+1234567890")).toBe("'+1234567890");
    expect(sanitizeCsvCell("-1234567890")).toBe("'-1234567890");
    expect(sanitizeCsvCell("@mention")).toBe("'@mention");
  });

  it("leaves ordinary text, numbers, and empty strings unchanged", () => {
    expect(sanitizeCsvCell("Adaeze Okonkwo")).toBe("Adaeze Okonkwo");
    expect(sanitizeCsvCell("ACTIVE")).toBe("ACTIVE");
    expect(sanitizeCsvCell(100)).toBe(100);
    expect(sanitizeCsvCell("")).toBe("");
  });

  it("does not flag a minus sign or an email that merely contains @ elsewhere", () => {
    expect(sanitizeCsvCell("jane@example.com")).toBe("jane@example.com");
    expect(sanitizeCsvCell("MEM-001")).toBe("MEM-001");
  });
});

describe("fetchMemberRegistryPage — keyset pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  const makeQueryMock = (rows: Record<string, unknown>[] | null, error: unknown = null) => {
    const query: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: rows, error }),
    };
    return query;
  };

  it("orders by member_number ascending and does not use gt() when no cursor is given", async () => {
    const query = makeQueryMock([{ member_number: "MEM-001", full_name: "A", email: null, phone: null, status: "ACTIVE", kyc_verified: true, joined_at: "2026-01-01" }]);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(query);

    await fetchMemberRegistryPage(undefined, 500);

    expect(query.order).toHaveBeenCalledWith("member_number", { ascending: true });
    expect(query.gt).not.toHaveBeenCalled();
  });

  it("uses gt(member_number, cursor) as the keyset cursor on subsequent pages", async () => {
    const query = makeQueryMock([]);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(query);

    await fetchMemberRegistryPage("MEM-500", 500);

    expect(query.gt).toHaveBeenCalledWith("member_number", "MEM-500");
  });

  it("returns nextCursor = last row's member_number when a full page comes back", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      member_number: `MEM-00${i + 1}`, full_name: `Member ${i + 1}`, email: null, phone: null,
      status: "ACTIVE", kyc_verified: false, joined_at: "2026-01-01",
    }));
    const query = makeQueryMock(rows);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(query);

    const { rows: result, nextCursor } = await fetchMemberRegistryPage(undefined, 3);
    expect(result).toHaveLength(3);
    expect(nextCursor).toBe("MEM-003");
  });

  it("returns nextCursor = null when fewer rows than the limit come back (end of data)", async () => {
    const rows = [{ member_number: "MEM-998", full_name: "Last", email: null, phone: null, status: "ACTIVE", kyc_verified: true, joined_at: "2026-01-01" }];
    const query = makeQueryMock(rows);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(query);

    const { nextCursor } = await fetchMemberRegistryPage("MEM-997", 500);
    expect(nextCursor).toBeNull();
  });

  it("returns an empty page (not an error) for a tenant with zero members", async () => {
    const query = makeQueryMock([]);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(query);

    const { rows, nextCursor } = await fetchMemberRegistryPage(undefined, 500);
    expect(rows).toEqual([]);
    expect(nextCursor).toBeNull();
  });
});

describe("requestReport — param validation happens server-side", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls request_report with the report type and params as given, and surfaces a server-side validation error", async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: "period_month out of range: 47" },
    });

    await expect(
      requestReport("CONTRIBUTION_SUMMARY", { period_month: 47, period_year: 2026 })
    ).rejects.toThrow();

    expect(supabase.rpc).toHaveBeenCalledWith("request_report", {
      p_report_type: "CONTRIBUTION_SUMMARY",
      p_params: { period_month: 47, period_year: 2026 },
    });
  });
});
