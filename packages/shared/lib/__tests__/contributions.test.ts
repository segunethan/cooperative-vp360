import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "../supabase";
import { recordMemberContribution, markContributionAsCompleted } from "../api/contributions";
import { NotFoundError, DuplicatePaymentReferenceError } from "../errors";

const tenantId = "tenant-uuid-abc";

describe("recordMemberContribution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up member UUID by member_number before inserting", async () => {
    const calledTables: string[] = [];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      calledTables.push(table);
      if (table === "members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "member-uuid-1" }, error: null }),
            }),
          }),
        };
      }
      // contributions table — insert
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    await recordMemberContribution({
      tenantId,
      memberNumber: "MEM-001",
      amountNaira: 25_000,
      channel: "bank_transfer",
    });

    expect(calledTables).toContain("members");
    expect(calledTables).toContain("contributions");
  });

  it("converts naira to kobo before inserting", async () => {
    let capturedInsert: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "member-uuid-1" }, error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          capturedInsert = payload;
          return Promise.resolve({ error: null });
        }),
      };
    });

    await recordMemberContribution({
      tenantId,
      memberNumber: "MEM-001",
      amountNaira: 25_000,
      channel: "cash",
    });

    // ₦25,000 → 2,500,000 kobo
    expect(capturedInsert?.amount_kobo).toBe(2_500_000);
  });

  it("throws NotFoundError when member_number does not exist", async () => {
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
      recordMemberContribution({ tenantId, memberNumber: "MEM-999", amountNaira: 1000, channel: "cash" })
    ).rejects.toThrow(NotFoundError);
  });

  it("generates a unique reference on each call", async () => {
    const insertedRefs: string[] = [];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "member-uuid-1" }, error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          insertedRefs.push(payload.reference as string);
          return Promise.resolve({ error: null });
        }),
      };
    });

    await recordMemberContribution({ tenantId, memberNumber: "MEM-001", amountNaira: 500, channel: "cash" });
    await recordMemberContribution({ tenantId, memberNumber: "MEM-001", amountNaira: 500, channel: "cash" });

    expect(insertedRefs).toHaveLength(2);
    expect(insertedRefs[0]).not.toBe(insertedRefs[1]);
  });

  it("throws DuplicatePaymentReferenceError on 23505 reference conflict", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "member-uuid-1" }, error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({
          error: { code: "23505", message: 'duplicate key violates unique constraint on "reference"' },
        }),
      };
    });

    await expect(
      recordMemberContribution({ tenantId, memberNumber: "MEM-001", amountNaira: 500, channel: "cash" })
    ).rejects.toThrow(DuplicatePaymentReferenceError);
  });
});

describe("markContributionAsCompleted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates status to COMPLETED and sets completed_at", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedUpdate = payload;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });

    await markContributionAsCompleted("contrib-uuid-1");

    expect(capturedUpdate?.status).toBe("COMPLETED");
    expect(capturedUpdate?.completed_at).toBeDefined();
    expect(new Date(capturedUpdate?.completed_at as string).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
