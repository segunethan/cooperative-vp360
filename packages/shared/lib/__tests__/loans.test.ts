import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "../supabase";
import { submitLoanApplication, approveLoanApplication, rejectLoanApplication } from "../api/loans";
import { NotFoundError } from "../errors";

const tenantId = "tenant-uuid-abc";

// loan_number is now assigned by the DB trigger — client never sends it.
const makeLoansTableMock = (
  onInsert?: (payload: Record<string, unknown>) => void
) => ({
  insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    if (onInsert) onInsert(payload);
    return Promise.resolve({ error: null });
  }),
});

const makeMembersTableMock = (memberUuid = "m-uuid-1") => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: memberUuid }, error: null }),
    }),
  }),
});

describe("submitLoanApplication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("converts principal from naira to kobo before insert", async () => {
    let capturedInsert: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") return makeMembersTableMock();
      if (table === "loans") return makeLoansTableMock((p) => { capturedInsert = p; });
      return {};
    });

    await submitLoanApplication({
      tenantId,
      memberNumber: "MEM-001",
      principalNaira: 500_000,
      interestRatePercent: 15,
      tenureMonths: 12,
    });

    // ₦500,000 = 50,000,000 kobo
    expect(capturedInsert?.principal_kobo).toBe(50_000_000);
  });

  it("converts interest rate percent to basis points", async () => {
    let capturedInsert: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") return makeMembersTableMock();
      if (table === "loans") return makeLoansTableMock((p) => { capturedInsert = p; });
      return {};
    });

    await submitLoanApplication({
      tenantId,
      memberNumber: "MEM-001",
      principalNaira: 100_000,
      interestRatePercent: 15,  // 15% = 1500 bps
      tenureMonths: 6,
    });

    expect(capturedInsert?.interest_rate_bps).toBe(1500);
  });

  it("sets status to PENDING on submit", async () => {
    let capturedInsert: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") return makeMembersTableMock();
      if (table === "loans") return makeLoansTableMock((p) => { capturedInsert = p; });
      return {};
    });

    await submitLoanApplication({
      tenantId,
      memberNumber: "MEM-001",
      principalNaira: 50_000,
      interestRatePercent: 10,
      tenureMonths: 3,
    });

    expect(capturedInsert?.status).toBe("PENDING");
  });

  it("does not include loan_number in the insert payload (DB trigger assigns it)", async () => {
    let capturedInsert: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") return makeMembersTableMock();
      if (table === "loans") return makeLoansTableMock((p) => { capturedInsert = p; });
      return {};
    });

    await submitLoanApplication({
      tenantId,
      memberNumber: "MEM-001",
      principalNaira: 50_000,
      interestRatePercent: 10,
      tenureMonths: 3,
    });

    expect(capturedInsert).not.toHaveProperty("loan_number");
  });

  it("throws NotFoundError when member does not exist", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116", message: "no rows" } }),
            }),
          }),
        };
      }
      return { insert: vi.fn() };
    });

    await expect(
      submitLoanApplication({ tenantId, memberNumber: "MEM-999", principalNaira: 1000, interestRatePercent: 5, tenureMonths: 1 })
    ).rejects.toThrow(NotFoundError);
  });
});

describe("approveLoanApplication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status APPROVED with approver and timestamp", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((p: Record<string, unknown>) => {
        capturedUpdate = p;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });

    await approveLoanApplication("loan-uuid-1", "user-uuid-admin");

    expect(capturedUpdate?.status).toBe("APPROVED");
    expect(capturedUpdate?.approved_by).toBe("user-uuid-admin");
    expect(capturedUpdate?.approved_at).toBeDefined();
  });
});

describe("rejectLoanApplication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to REJECTED", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((p: Record<string, unknown>) => {
        capturedUpdate = p;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });

    await rejectLoanApplication("loan-uuid-1");
    expect(capturedUpdate?.status).toBe("REJECTED");
  });
});
