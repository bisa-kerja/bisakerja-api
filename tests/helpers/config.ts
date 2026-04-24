import type { AppConfig } from "@/config/env";
import { loadEnv } from "@/config/env";

export function testConfig(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): AppConfig {
  return loadEnv({
    APP_NAME: "bisakerja-api",
    APP_ENV: "test",
    NODE_ENV: "test",
    PORT: "3000",
    API_PREFIX: "/api/v1",
    APP_URL: "http://localhost:3000",
    FRONTEND_URL: "http://localhost:5173",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/bisakerja_api_test",
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || "",
    PRISMA_LOG_LEVEL: "warn",
    CORS_ORIGINS: "http://localhost:5173",
    TRUST_PROXY: "false",
    REQUEST_BODY_LIMIT: "1mb",
    RATE_LIMIT_WINDOW_MS: "60000",
    RATE_LIMIT_MAX: "120",
    AUTH_RATE_LIMIT_MAX: "10",
    UPLOAD_RATE_LIMIT_MAX: "10",
    AI_RATE_LIMIT_MAX: "20",
    AUTH_ACCESS_TOKEN_SECRET: "test-access-token-secret-change-me-32",
    AUTH_REFRESH_TOKEN_SECRET: "test-refresh-token-secret-change-me-32",
    AUTH_ACCESS_TOKEN_TTL: "15m",
    AUTH_REFRESH_TOKEN_TTL: "7d",
    PASSWORD_RESET_TOKEN_TTL: "30m",
    EMAIL_VERIFICATION_OTP_TTL: "10m",
    AUTH_REFRESH_COOKIE_NAME: "bisakerja_refresh",
    AUTH_COOKIE_SECURE: "false",
    AUTH_COOKIE_SAME_SITE: "lax",
    AUTH_ISSUER: "bisakerja-api",
    AUTH_AUDIENCE: "bisakerja-frontend",
    EMAIL_PROVIDER: "fake",
    EMAIL_FROM: "Bisakerja <no-reply@example.test>",
    RESEND_API_KEY: "",
    RESEND_MAX_RETRIES: "2",
    MODEL_API_BASE_URL: "http://localhost:8000",
    MODEL_API_TIMEOUT_MS: "10000",
    MODEL_API_SERVICE_TOKEN: "test-model-service-token",
    MODEL_API_ENABLE_MOCK: "true",
    FILE_STORAGE_DRIVER: "local",
    UPLOAD_STORAGE_PATH: "/tmp/bisakerja-api-test/uploads",
    CV_UPLOAD_MAX_BYTES: "5242880",
    CV_ALLOWED_MIME_TYPES: "application/pdf",
    CV_RETENTION_DAYS: "1",
    LOG_LEVEL: "silent",
    REQUEST_ID_HEADER: "x-request-id",
    ENABLE_REQUEST_LOGGING: "false",
    HEALTH_CHECK_TIMEOUT_MS: "2000",
    ...overrides
  });
}
