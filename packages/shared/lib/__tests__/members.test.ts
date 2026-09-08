import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Supabase before importing anything that uses it ──────────────────────
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

// Each mock resets and chains correctly
const makeChain = () => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
});

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(() => makeChain()),
  },
}));

import { supabase } from "../supabase";
import {
  addNewMember,
  approveMemberApplication,
  suspendMember,
  exitMember,
  markMemberKycVerified,
} from "../api/members";
import { ApiError, DuplicateRecordError } from "../errors";

const tenantId = "tenant-uuid-123";

describe("addNewMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("concatenates firstName + lastName into full_name with trimming", async () => {
    let capturedInsertPayload: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedInsertPayload = payload;
        return Promise.resolve({ error: null });
      }),
    });

    await addNewMember(tenantId, {
      firstName: "  John  ",
      lastName: "  Doe  ",
      email: "john@example.com",
      phone: "+234 801 234 5678",
    });

    expect(capturedInsertPayload).not.toBeNull();
    expect((capturedInsertPayload as Record<string, unknown>).full_name).toBe("John Doe");
  });

  it("lowercases the email before inserting", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return Promise.resolve({ error: null });
      }),
    });

    await addNewMember(tenantId, {
      firstName: "Jane",
      lastName: "Doe",
      email: "JANE@EXAMPLE.COM",
      phone: "+234 800 000 0000",
    });

    expect((capturedPayload as Record<string, unknown>).email).toBe("jane@example.com");
  });

  it("sets tenant_id on the insert payload", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return Promise.resolve({ error: null });
      }),
    });

    await addNewMember(tenantId, {
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      phone: "1234",
    });

    expect((capturedPayload as Record<string, unknown>).tenant_id).toBe(tenantId);
  });

  it("sets initial status to INVITED", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return Promise.resolve({ error: null });
      }),
    });

    await addNewMember(tenantId, {
      firstName: "Test",
      lastName: "User",
      email: "test@test.com",
      phone: "000",
    });

    expect((capturedPayload as Record<string, unknown>).status).toBe("INVITED");
  });

  it("throws DuplicateRecordError when email already exists (23505)", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate key value violates unique constraint on email" },
      }),
    });

    await expect(
      addNewMember(tenantId, { firstName: "X", lastName: "Y", email: "dup@test.com", phone: "000" })
    ).rejects.toThrow(DuplicateRecordError);
  });
});

describe("approveMemberApplication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update with status ACTIVE and correct member_number", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;
    let capturedEqValue: unknown = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedUpdate = payload;
        return {
          eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
            capturedEqValue = val;
            return Promise.resolve({ error: null });
          }),
        };
      }),
    });

    await approveMemberApplication("MEM-001");

    expect(capturedUpdate?.status).toBe("ACTIVE");
    expect(capturedEqValue).toBe("MEM-001");
  });

  it("throws ApiError when supabase returns an error", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { code: "42501", message: "insufficient privilege" } }),
      }),
    });

    await expect(approveMemberApplication("MEM-001")).rejects.toThrow(ApiError);
  });
});

describe("suspendMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update with status SUSPENDED", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedUpdate = payload;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });

    await suspendMember("MEM-002");
    expect(capturedUpdate?.status).toBe("SUSPENDED");
  });
});

describe("exitMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update with status EXITED", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedUpdate = payload;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });

    await exitMember("MEM-003");
    expect(capturedUpdate?.status).toBe("EXITED");
  });
});

describe("markMemberKycVerified", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets kyc_verified true and kyc_verified_at timestamp", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedUpdate = payload;
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    });

    await markMemberKycVerified("MEM-004");
    expect(capturedUpdate?.kyc_verified).toBe(true);
    expect(capturedUpdate?.kyc_verified_at).toBeDefined();
  });
});
