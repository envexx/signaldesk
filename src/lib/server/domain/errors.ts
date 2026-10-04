import "server-only";

export type ErrorFields = Record<string, string[]>;

/**
 * Base application error. Carries a stable machine-readable `code` and the HTTP
 * status the API layer should use. Never include stack traces or secrets in the
 * message shown to clients.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: ErrorFields;

  constructor(
    code: string,
    message: string,
    status = 400,
    fields?: ErrorFields,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request payload is invalid", fields?: ErrorFields) {
    super("VALIDATION_ERROR", message, 400, fields);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Lead was not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current state") {
    super("CONFLICT", message, 409);
  }
}

export class NotReadyError extends AppError {
  constructor(message = "Lead is not ready for this action") {
    super("NOT_READY", message, 409);
  }
}

export class VersionConflictError extends AppError {
  constructor(message = "The draft changed since it was loaded") {
    super("VERSION_CONFLICT", message, 409);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = "The request is valid but cannot be processed", fields?: ErrorFields) {
    super("UNPROCESSABLE_ENTITY", message, 422, fields);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Request signature is invalid") {
    super("INVALID_SIGNATURE", message, 401);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super("RATE_LIMITED", message, 429);
  }
}

/** External provider call failed in a mapped, retryable way (HTTP 502). */
export class ProviderFailureError extends AppError {
  constructor(message = "An external provider failed", code = "PROVIDER_FAILED") {
    super(code, message, 502);
  }
}

/** A required provider is not configured or is disabled (HTTP 503). */
export class ProviderUnavailableError extends AppError {
  constructor(message = "The requested provider is not available", code = "PROVIDER_UNAVAILABLE") {
    super(code, message, 503);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
