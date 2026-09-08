// ─── Error classes ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string = "UNKNOWN",
    public readonly hint?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(entity: string, identifier: string) {
    super(`${entity} "${identifier}" not found.`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class DuplicateRecordError extends ApiError {
  constructor(field: string) {
    super(
      `A record with this ${field} already exists.`,
      "DUPLICATE_RECORD"
    );
    this.name = "DuplicateRecordError";
  }
}

export class DuplicatePaymentReferenceError extends ApiError {
  constructor() {
    super(
      "Duplicate payment reference detected — this transaction may have already been submitted.",
      "DUPLICATE_PAYMENT_REFERENCE"
    );
    this.name = "DuplicatePaymentReferenceError";
  }
}

export class TenantIsolationError extends ApiError {
  constructor() {
    super(
      "Access denied. Your session does not have permission to perform this action.",
      "TENANT_ISOLATION"
    );
    this.name = "TenantIsolationError";
  }
}

export class InvalidAmountError extends ApiError {
  constructor() {
    super("Amount must be greater than zero.", "INVALID_AMOUNT");
    this.name = "InvalidAmountError";
  }
}

// ─── PostgreSQL / PostgREST error mapping ─────────────────────────────────────

interface SupabaseError {
  code?: string;
  message: string;
  hint?: string;
  details?: string;
}

export const handleSupabaseError = (error: SupabaseError): never => {
  const { code = "", message, hint } = error;

  // Unique constraint violation
  if (code === "23505") {
    if (message.includes("reference")) throw new DuplicatePaymentReferenceError();
    if (message.includes("email"))     throw new DuplicateRecordError("email address");
    if (message.includes("member_number")) throw new DuplicateRecordError("member number");
    if (message.includes("period"))    throw new DuplicateRecordError("dividend period");
    throw new DuplicateRecordError("field");
  }

  // Foreign key violation — referenced row doesn't exist
  if (code === "23503") {
    throw new ApiError(
      "Referenced record does not exist or has been deleted.",
      "FK_VIOLATION",
      hint
    );
  }

  // RLS / insufficient privilege
  if (code === "42501" || code === "PGRST301") {
    throw new TenantIsolationError();
  }

  // PostgREST: zero rows returned from .single()
  if (code === "PGRST116") {
    throw new ApiError("Record not found.", "NOT_FOUND");
  }

  // PostgREST: schema cache miss (usually a missing table/function)
  if (code === "PGRST202") {
    throw new ApiError(
      "Database function not found. Run the latest migration and try again.",
      "SCHEMA_CACHE_MISS"
    );
  }

  // Auth errors
  if (message.toLowerCase().includes("invalid login credentials")) {
    throw new ApiError("Incorrect email or password.", "INVALID_CREDENTIALS");
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    throw new ApiError(
      "Please verify your email address before signing in.",
      "EMAIL_NOT_VERIFIED"
    );
  }

  // Generic fallback — include message for developer visibility
  throw new ApiError(message, code, hint);
};
