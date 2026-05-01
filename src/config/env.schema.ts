import { z } from "zod";

const requiredString = (name: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `${name} is required` });

const requiredUrl = (name: string) =>
  requiredString(name).pipe(z.url({ message: `${name} must be a valid URL` }));

const booleanSchema = z
  .union([z.boolean(), requiredString("boolean value")])
  .transform((value, ctx) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    ctx.addIssue({
      code: "custom",
      message: "Expected boolean string true or false"
    });
    return z.NEVER;
  });

const numberFromString = (name: string) =>
  z.union([z.number(), requiredString(name)]).transform((value, ctx) => {
    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      ctx.addIssue({
        code: "custom",
        message: "Expected numeric value"
      });
      return z.NEVER;
    }

    return parsed;
  });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailFromSchema = z
  .string()
  .min(1)
  .refine(
    (value) => {
      if (emailPattern.test(value)) {
        return true;
      }

      const displayMatch = /^.+ <([^<>]+)>$/.exec(value);
      return Boolean(displayMatch?.[1] && emailPattern.test(displayMatch[1]));
    },
    {
      message:
        "Expected a valid sender address like email@example.com or Name <email@example.com>"
    }
  );

export const envSchema = z
  .object({
    APP_NAME: requiredString("APP_NAME"),
    APP_ENV: z.enum(["local", "test", "staging", "production"]),
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: numberFromString("PORT").pipe(z.number().int().min(1).max(65535)),
    API_PREFIX: requiredString("API_PREFIX").startsWith("/"),
    APP_URL: requiredUrl("APP_URL"),
    FRONTEND_URL: requiredUrl("FRONTEND_URL"),
    DATABASE_URL: requiredUrl("DATABASE_URL"),
    DIRECT_DATABASE_URL: requiredUrl("DIRECT_DATABASE_URL"),
    PRISMA_LOG_LEVEL: z.enum(["query", "info", "warn", "error"]),
    CORS_ORIGINS: requiredString("CORS_ORIGINS"),
    TRUST_PROXY: booleanSchema,
    REQUEST_BODY_LIMIT: requiredString("REQUEST_BODY_LIMIT"),
    RATE_LIMIT_WINDOW_MS: numberFromString("RATE_LIMIT_WINDOW_MS").pipe(
      z.number().int().positive()
    ),
    RATE_LIMIT_MAX: numberFromString("RATE_LIMIT_MAX").pipe(
      z.number().int().positive()
    ),
    AUTH_RATE_LIMIT_MAX: numberFromString("AUTH_RATE_LIMIT_MAX").pipe(
      z.number().int().positive()
    ),
    UPLOAD_RATE_LIMIT_MAX: numberFromString("UPLOAD_RATE_LIMIT_MAX").pipe(
      z.number().int().positive()
    ),
    AI_RATE_LIMIT_MAX: numberFromString("AI_RATE_LIMIT_MAX").pipe(
      z.number().int().positive()
    ),
    AUTH_ACCESS_TOKEN_SECRET: requiredString("AUTH_ACCESS_TOKEN_SECRET").min(
      32
    ),
    AUTH_REFRESH_TOKEN_SECRET: requiredString("AUTH_REFRESH_TOKEN_SECRET").min(
      32
    ),
    AUTH_ACCESS_TOKEN_TTL: requiredString("AUTH_ACCESS_TOKEN_TTL"),
    AUTH_REFRESH_TOKEN_TTL: requiredString("AUTH_REFRESH_TOKEN_TTL"),
    PASSWORD_RESET_TOKEN_TTL: requiredString("PASSWORD_RESET_TOKEN_TTL"),
    EMAIL_VERIFICATION_OTP_TTL: requiredString("EMAIL_VERIFICATION_OTP_TTL"),
    AUTH_REFRESH_COOKIE_NAME: requiredString("AUTH_REFRESH_COOKIE_NAME"),
    AUTH_COOKIE_SECURE: booleanSchema,
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]),
    AUTH_ISSUER: requiredString("AUTH_ISSUER"),
    AUTH_AUDIENCE: requiredString("AUTH_AUDIENCE"),
    EMAIL_PROVIDER: z.enum(["fake", "resend"]),
    EMAIL_FROM: emailFromSchema,
    RESEND_API_KEY: requiredString("RESEND_API_KEY"),
    RESEND_MAX_RETRIES: numberFromString("RESEND_MAX_RETRIES").pipe(
      z.number().int().min(0).max(5)
    ),
    REDIS_URL: requiredUrl("REDIS_URL"),
    ASYNC_QUEUE_NAME: requiredString("ASYNC_QUEUE_NAME"),
    ASYNC_QUEUE_PREFIX: requiredString("ASYNC_QUEUE_PREFIX"),
    ASYNC_QUEUE_CONCURRENCY: numberFromString("ASYNC_QUEUE_CONCURRENCY").pipe(
      z.number().int().positive()
    ),
    ASYNC_QUEUE_MAX_ATTEMPTS: numberFromString("ASYNC_QUEUE_MAX_ATTEMPTS").pipe(
      z.number().int().min(1).max(10)
    ),
    ASYNC_QUEUE_BACKOFF_MS: numberFromString("ASYNC_QUEUE_BACKOFF_MS").pipe(
      z.number().int().positive()
    ),
    ASYNC_QUEUE_RECOVERY_BATCH_SIZE: numberFromString(
      "ASYNC_QUEUE_RECOVERY_BATCH_SIZE"
    ).pipe(z.number().int().positive()),
    ASYNC_QUEUE_RECOVERY_INTERVAL_MS: numberFromString(
      "ASYNC_QUEUE_RECOVERY_INTERVAL_MS"
    ).pipe(z.number().int().positive()),
    MODEL_API_BASE_URL: requiredUrl("MODEL_API_BASE_URL"),
    MODEL_API_TIMEOUT_MS: numberFromString("MODEL_API_TIMEOUT_MS").pipe(
      z.number().int().positive()
    ),
    MODEL_API_SERVICE_TOKEN: requiredString("MODEL_API_SERVICE_TOKEN"),
    MODEL_API_ENABLE_MOCK: booleanSchema,
    SCRAPER_API_SERVICE_TOKEN: requiredString("SCRAPER_API_SERVICE_TOKEN"),
    FILE_STORAGE_DRIVER: z.enum(["local"]),
    UPLOAD_STORAGE_PATH: requiredString("UPLOAD_STORAGE_PATH"),
    CV_UPLOAD_MAX_BYTES: numberFromString("CV_UPLOAD_MAX_BYTES").pipe(
      z.number().int().positive()
    ),
    CV_ALLOWED_MIME_TYPES: requiredString("CV_ALLOWED_MIME_TYPES").transform(
      (value) =>
        value
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
    ),
    CV_RETENTION_DAYS: numberFromString("CV_RETENTION_DAYS").pipe(
      z.number().int().positive()
    ),
    JOB_STALE_AFTER_HOURS: numberFromString("JOB_STALE_AFTER_HOURS").pipe(
      z.number().int().positive()
    ),
    LOG_LEVEL: z.enum([
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
      "silent"
    ]),
    REQUEST_ID_HEADER: requiredString("REQUEST_ID_HEADER"),
    ENABLE_REQUEST_LOGGING: booleanSchema,
    HEALTH_CHECK_TIMEOUT_MS: numberFromString("HEALTH_CHECK_TIMEOUT_MS").pipe(
      z.number().int().positive()
    )
  })
  .superRefine((value, ctx) => {
    const origins = value.CORS_ORIGINS.split(",").map((origin) =>
      origin.trim()
    );

    if (value.APP_ENV === "production" && origins.includes("*")) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "Wildcard CORS origins are not allowed in production"
      });
    }

    if (value.APP_ENV === "production" && !value.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_SECURE"],
        message: "Refresh cookies must be secure in production"
      });
    }

    if (value.AUTH_COOKIE_SAME_SITE === "none" && !value.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_SAME_SITE"],
        message: "SameSite none requires secure cookies"
      });
    }

    if (value.APP_ENV === "production" && value.EMAIL_PROVIDER === "fake") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message: "Fake email provider is not allowed in production"
      });
    }

    if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend"
      });
    }

    if (!value.MODEL_API_ENABLE_MOCK && !value.MODEL_API_SERVICE_TOKEN) {
      ctx.addIssue({
        code: "custom",
        path: ["MODEL_API_SERVICE_TOKEN"],
        message:
          "MODEL_API_SERVICE_TOKEN is required when MODEL_API_ENABLE_MOCK=false"
      });
    }

    if (value.CV_ALLOWED_MIME_TYPES.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["CV_ALLOWED_MIME_TYPES"],
        message: "At least one allowed CV MIME type is required"
      });
    }
  });
