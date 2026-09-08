import { describe, it, expect } from "vitest";
import {
  ApiError,
  NotFoundError,
  DuplicateRecordError,
  DuplicatePaymentReferenceError,
  TenantIsolationError,
  handleSupabaseError,
} from "../errors";

describe("ApiError", () => {
  it("sets name, message and code", () => {
    const err = new ApiError("something went wrong", "GENERIC");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe("ApiError");
    expect(err.message).toBe("something went wrong");
    expect(err.code).toBe("GENERIC");
  });

  it("defaults code to UNKNOWN when omitted", () => {
    const err = new ApiError("oops");
    expect(err.code).toBe("UNKNOWN");
  });
});

describe("NotFoundError", () => {
  it("includes entity and identifier in message", () => {
    const err = new NotFoundError("Member", "MEM-001");
    expect(err.message).toContain("Member");
    expect(err.message).toContain("MEM-001");
    expect(err.code).toBe("NOT_FOUND");
  });
});

describe("DuplicateRecordError", () => {
  it("includes the field name", () => {
    const err = new DuplicateRecordError("email address");
    expect(err.message).toContain("email address");
    expect(err.code).toBe("DUPLICATE_RECORD");
  });
});

describe("handleSupabaseError", () => {
  it("maps 23505 with email to DuplicateRecordError", () => {
    expect(() =>
      handleSupabaseError({ code: "23505", message: "duplicate key value violates unique constraint on email" })
    ).toThrow(DuplicateRecordError);
  });

  it("maps 23505 with reference to DuplicatePaymentReferenceError", () => {
    expect(() =>
      handleSupabaseError({ code: "23505", message: 'unique constraint "contributions_reference_key" on reference' })
    ).toThrow(DuplicatePaymentReferenceError);
  });

  it("maps 42501 to TenantIsolationError", () => {
    expect(() =>
      handleSupabaseError({ code: "42501", message: "insufficient privilege" })
    ).toThrow(TenantIsolationError);
  });

  it("maps PGRST116 (no rows) to ApiError with NOT_FOUND code", () => {
    expect(() =>
      handleSupabaseError({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })
    ).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("maps invalid login credentials to ApiError", () => {
    expect(() =>
      handleSupabaseError({ code: "400", message: "Invalid login credentials" })
    ).toThrow(expect.objectContaining({ code: "INVALID_CREDENTIALS" }));
  });

  it("falls through to generic ApiError for unknown codes", () => {
    const error = { code: "99999", message: "some unknown db error" };
    expect(() => handleSupabaseError(error)).toThrow(ApiError);
    try {
      handleSupabaseError(error);
    } catch (e) {
      expect((e as ApiError).code).toBe("99999");
      expect((e as ApiError).message).toBe("some unknown db error");
    }
  });
});
