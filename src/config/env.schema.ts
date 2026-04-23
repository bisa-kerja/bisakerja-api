import { z } from "zod";

const booleanSchema = z
  .union([z.boolean(), z.string()])
  .default(false)
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

const numberFromString = (defaultValue: number) =>
  z
    .union([z.number(), z.string()])
    .default(defaultValue)
    .transform((value, ctx) => {
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

export const envSchema = z
  .object({
    APP_NAME: z.string().min(1).default("bisakerja-api"),
    APP_ENV: z
      .enum(["local", "test", "staging", "production"])
      .default("local"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: numberFromString(3000).pipe(z.number().int().min(1).max(65535)),
    API_PREFIX: z.string().startsWith("/").default("/api/v1"),
    APP_URL: z.url().default("http://localhost:3000"),
    FRONTEND_URL: z.url().default("http://localhost:5173"),
    DATABASE_URL: z
      .url()
      .default("postgresql://postgres:postgres@localhost:5432/bisakerja_api"),
    DIRECT_DATABASE_URL: z.string().optional().default(""),
    PRISMA_LOG_LEVEL: z
      .enum(["query", "info", "warn", "error"])
      .default("warn"),
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    TRUST_PROXY: booleanSchema.default(false),
    REQUEST_BODY_LIMIT: z.string().min(1).default("1mb"),
    RATE_LIMIT_WINDOW_MS: numberFromString(60000).pipe(
      z.number().int().positive()
    ),
    RATE_LIMIT_MAX: numberFromString(120).pipe(z.number().int().positive()),
    AUTH_RATE_LIMIT_MAX: numberFromString(10).pipe(z.number().int().positive()),
    UPLOAD_RATE_LIMIT_MAX: numberFromString(10).pipe(
      z.number().int().positive()
    ),
    AI_RATE_LIMIT_MAX: numberFromString(20).pipe(z.number().int().positive()),
    AUTH_ACCESS_TOKEN_SECRET: z
      .string()
      .min(32)
      .default("local-access-token-secret-change-me-32"),
    AUTH_REFRESH_TOKEN_SECRET: z
      .string()
      .min(32)
      .default("local-refresh-token-secret-change-me-32"),
    AUTH_ACCESS_TOKEN_TTL: z.string().min(1).default("15m"),
    AUTH_REFRESH_TOKEN_TTL: z.string().min(1).default("7d"),
    PASSWORD_RESET_TOKEN_TTL: z.string().min(1).default("30m"),
    EMAIL_VERIFICATION_OTP_TTL: z.string().min(1).default("10m"),
    AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default("bisakerja_refresh"),
    AUTH_COOKIE_SECURE: booleanSchema.default(false),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_ISSUER: z.string().min(1).default("bisakerja-api"),
    AUTH_AUDIENCE: z.string().min(1).default("bisakerja-frontend"),
    EMAIL_PROVIDER: z.enum(["fake", "smtp"]).default("fake"),
    EMAIL_FROM: z.email().default("no-reply@example.test"),
    SMTP_HOST: z.string().optional().default(""),
    SMTP_PORT: numberFromString(587).pipe(z.number().int().positive()),
    SMTP_USER: z.string().optional().default(""),
    SMTP_PASSWORD: z.string().optional().default(""),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    REQUEST_ID_HEADER: z.string().min(1).default("x-request-id"),
    ENABLE_REQUEST_LOGGING: booleanSchema.default(true),
    HEALTH_CHECK_TIMEOUT_MS: numberFromString(2000).pipe(
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

    if (value.EMAIL_PROVIDER === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when EMAIL_PROVIDER=smtp`
          });
        }
      }
    }
  });
