import { envSchema } from "@/config/env.schema";
import type { AppConfig } from "@/config/env.types";
export type { AppConfig, AppEnvironment } from "@/config/env.types";

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
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
      smtp: {
        host: parsed.SMTP_HOST,
        port: parsed.SMTP_PORT,
        user: parsed.SMTP_USER,
        password: parsed.SMTP_PASSWORD
      }
    },
    database: {
      url: parsed.DIRECT_DATABASE_URL || parsed.DATABASE_URL,
      runtimeUrl: parsed.DATABASE_URL,
      directUrl: parsed.DIRECT_DATABASE_URL || null,
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

export const env = loadEnv();
