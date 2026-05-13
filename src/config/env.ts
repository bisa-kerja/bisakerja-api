import { envSchema } from "@/config/env.schema";
import type { AppConfig } from "@/config/env.types";
export type { AppConfig, AppEnvironment } from "@/config/env.types";

let cachedEnv: AppConfig | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);
  const corsOrigins = Array.from(
    new Set(
      [
        ...parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
        parsed.FRONTEND_URL,
        parsed.APP_URL
      ]
        .map(normalizeOrigin)
        .filter(Boolean)
    )
  );

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
    auth: {
      accessTokenSecret: parsed.AUTH_ACCESS_TOKEN_SECRET,
      refreshTokenSecret: parsed.AUTH_REFRESH_TOKEN_SECRET,
      accessTokenTtl: parsed.AUTH_ACCESS_TOKEN_TTL,
      refreshTokenTtl: parsed.AUTH_REFRESH_TOKEN_TTL,
      passwordResetTokenTtl: parsed.PASSWORD_RESET_TOKEN_TTL,
      emailVerificationOtpTtl: parsed.EMAIL_VERIFICATION_OTP_TTL,
      refreshCookieName: parsed.AUTH_REFRESH_COOKIE_NAME,
      cookieSecure: parsed.AUTH_COOKIE_SECURE,
      cookieSameSite: parsed.AUTH_COOKIE_SAME_SITE,
      issuer: parsed.AUTH_ISSUER,
      audience: parsed.AUTH_AUDIENCE
    },
    email: {
      provider: parsed.EMAIL_PROVIDER,
      from: parsed.EMAIL_FROM,
      resend: {
        apiKey: parsed.RESEND_API_KEY,
        maxRetries: parsed.RESEND_MAX_RETRIES
      }
    },
    asyncWorkloads: {
      redisUrl: parsed.REDIS_URL,
      queueName: parsed.ASYNC_QUEUE_NAME,
      queuePrefix: parsed.ASYNC_QUEUE_PREFIX,
      workerConcurrency: parsed.ASYNC_QUEUE_CONCURRENCY,
      maxAttempts: parsed.ASYNC_QUEUE_MAX_ATTEMPTS,
      backoffMs: parsed.ASYNC_QUEUE_BACKOFF_MS,
      recoveryBatchSize: parsed.ASYNC_QUEUE_RECOVERY_BATCH_SIZE,
      recoveryIntervalMs: parsed.ASYNC_QUEUE_RECOVERY_INTERVAL_MS
    },
    integrations: {
      modelApi: {
        baseUrl: parsed.MODEL_API_BASE_URL,
        timeoutMs: parsed.MODEL_API_TIMEOUT_MS,
        serviceToken: parsed.MODEL_API_SERVICE_TOKEN,
        enableMock: parsed.MODEL_API_ENABLE_MOCK
      },
      scraperApi: {
        serviceToken: parsed.SCRAPER_API_SERVICE_TOKEN
      },
      googleOauth: {
        enabled: parsed.GOOGLE_OAUTH_ENABLED,
        clientId: parsed.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: parsed.GOOGLE_OAUTH_CLIENT_SECRET,
        redirectUri: parsed.GOOGLE_OAUTH_REDIRECT_URI
      }
    },
    uploads: {
      fileStorageDriver: parsed.FILE_STORAGE_DRIVER,
      storagePath: parsed.UPLOAD_STORAGE_PATH,
      cvUploadMaxBytes: parsed.CV_UPLOAD_MAX_BYTES,
      cvAllowedMimeTypes: parsed.CV_ALLOWED_MIME_TYPES,
      cvRetentionDays: parsed.CV_RETENTION_DAYS
    },
    jobs: {
      staleAfterHours: parsed.JOB_STALE_AFTER_HOURS
    },
    database: {
      runtimeUrl: parsed.DATABASE_URL,
      directUrl: parsed.DIRECT_DATABASE_URL,
      prismaLogLevel: parsed.PRISMA_LOG_LEVEL
    },
    observability: {
      logLevel: parsed.LOG_LEVEL,
      requestIdHeader: parsed.REQUEST_ID_HEADER.toLowerCase(),
      enableRequestLogging: parsed.ENABLE_REQUEST_LOGGING,
      healthCheckTimeoutMs: parsed.HEALTH_CHECK_TIMEOUT_MS
    }
  };
}

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = loadEnv(source);
  return cachedEnv;
}

export const env = new Proxy({} as AppConfig, {
  get(_target, property: keyof AppConfig) {
    return getEnv()[property];
  }
});

function normalizeOrigin(value: string) {
  if (value === "*") {
    return value;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
