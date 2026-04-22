export type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  isOperational?: boolean;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;
  readonly isOperational: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details ?? null;
    this.isOperational = options.isOperational ?? true;
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = "Bad request",
    code = "BAD_REQUEST",
    details: unknown = null
  ) {
    super({ statusCode: 400, code, message, details });
  }
}

export class AuthenticationError extends AppError {
  constructor(
    message = "Authentication required",
    code = "UNAUTHENTICATED",
    details: unknown = null
  ) {
    super({ statusCode: 401, code, message, details });
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message = "You are not allowed to access this resource",
    code = "FORBIDDEN",
    details: unknown = null
  ) {
    super({ statusCode: 403, code, message, details });
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    code = "NOT_FOUND",
    details: unknown = null
  ) {
    super({ statusCode: 404, code, message, details });
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Request conflicts with current state",
    code = "CONFLICT",
    details: unknown = null
  ) {
    super({ statusCode: 409, code, message, details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(
    message = "Request body is too large",
    code = "PAYLOAD_TOO_LARGE",
    details: unknown = null
  ) {
    super({ statusCode: 413, code, message, details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details: unknown = null) {
    super({ statusCode: 422, code: "VALIDATION_ERROR", message, details });
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = "Too many requests",
    code = "RATE_LIMITED",
    details: unknown = null
  ) {
    super({ statusCode: 429, code, message, details });
  }
}

export class DownstreamError extends AppError {
  constructor(
    message = "Downstream service failed",
    code = "DOWNSTREAM_ERROR",
    details: unknown = null
  ) {
    super({ statusCode: 502, code, message, details });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Service temporarily unavailable",
    code = "SERVICE_UNAVAILABLE",
    details: unknown = null
  ) {
    super({ statusCode: 503, code, message, details });
  }
}
