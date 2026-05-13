import type { AppErrorOptions } from "@/core/errors/app-error.types";
export type { AppErrorOptions } from "@/core/errors/app-error.types";

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
    message = "Permintaan tidak valid",
    code = "BAD_REQUEST",
    details: unknown = null
  ) {
    super({ statusCode: 400, code, message, details });
  }
}

export class AuthenticationError extends AppError {
  constructor(
    message = "Autentikasi diperlukan",
    code = "UNAUTHENTICATED",
    details: unknown = null
  ) {
    super({ statusCode: 401, code, message, details });
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message = "Anda tidak memiliki akses ke resource ini",
    code = "FORBIDDEN",
    details: unknown = null
  ) {
    super({ statusCode: 403, code, message, details });
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = "Resource tidak ditemukan",
    code = "NOT_FOUND",
    details: unknown = null
  ) {
    super({ statusCode: 404, code, message, details });
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Permintaan bertentangan dengan kondisi saat ini",
    code = "CONFLICT",
    details: unknown = null
  ) {
    super({ statusCode: 409, code, message, details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(
    message = "Payload terlalu besar",
    code = "PAYLOAD_TOO_LARGE",
    details: unknown = null
  ) {
    super({ statusCode: 413, code, message, details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validasi gagal", details: unknown = null) {
    super({ statusCode: 422, code: "VALIDATION_ERROR", message, details });
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = "Terlalu banyak permintaan",
    code = "RATE_LIMITED",
    details: unknown = null
  ) {
    super({ statusCode: 429, code, message, details });
  }
}

export class DownstreamError extends AppError {
  constructor(
    message = "Layanan dependensi gagal",
    code = "DOWNSTREAM_ERROR",
    details: unknown = null
  ) {
    super({ statusCode: 502, code, message, details });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Layanan sementara tidak tersedia",
    code = "SERVICE_UNAVAILABLE",
    details: unknown = null
  ) {
    super({ statusCode: 503, code, message, details });
  }
}

export class NotImplementedError extends AppError {
  constructor(
    message = "Fitur belum tersedia",
    code = "NOT_IMPLEMENTED",
    details: unknown = null
  ) {
    super({ statusCode: 501, code, message, details });
  }
}
