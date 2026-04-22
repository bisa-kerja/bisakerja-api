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

const envSchema = z
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
  });

export type AppConfig = ReturnType<typeof loadEnv>;
export type AppEnvironment = z.infer<typeof envSchema>["APP_ENV"];

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(source);
  const corsOrigins = parsed.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    app: {
      name: parsed.APP_NAME,
      env: parsed.APP_ENV,
      nodeEnv: parsed.NODE_ENV,
      port: parsed.PORT,
      apiPrefix: parsed.API_PREFIX,
      appUrl: parsed.APP_URL,
      frontendUrl: parsed.FRONTEND_URL
    },
    security: {
      corsOrigins,
      trustProxy: parsed.TRUST_PROXY,
      requestBodyLimit: parsed.REQUEST_BODY_LIMIT,
      rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
      rateLimitMax: parsed.RATE_LIMIT_MAX,
      authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
      uploadRateLimitMax: parsed.UPLOAD_RATE_LIMIT_MAX,
      aiRateLimitMax: parsed.AI_RATE_LIMIT_MAX
    },
    observability: {
      logLevel: parsed.LOG_LEVEL,
      requestIdHeader: parsed.REQUEST_ID_HEADER.toLowerCase(),
      enableRequestLogging: parsed.ENABLE_REQUEST_LOGGING,
      healthCheckTimeoutMs: parsed.HEALTH_CHECK_TIMEOUT_MS
    }
  };
}

export const env = loadEnv();
