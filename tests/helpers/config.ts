import type { AppConfig } from "@/config/env";
import { loadEnv } from "@/config/env";

function requireConfiguredTestEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for test configuration.`);
  }

  return value;
}

const testDatabaseUrl = requireConfiguredTestEnv("DATABASE_URL");
const testDirectDatabaseUrl = requireConfiguredTestEnv("DIRECT_DATABASE_URL");

export const testEnv = {
  APP_NAME: "bisakerja-api",
  APP_ENV: "test",
  NODE_ENV: "test",
  PORT: "3000",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3000",
  FRONTEND_URL: "http://localhost:5173",
  DATABASE_URL: testDatabaseUrl,
  DIRECT_DATABASE_URL: testDirectDatabaseUrl,
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
  RESEND_API_KEY: "test-resend-api-key",
  RESEND_MAX_RETRIES: "2",
  REDIS_URL: "redis://127.0.0.1:6379",
  ASYNC_QUEUE_NAME: "bisakerja-async-test",
  ASYNC_QUEUE_PREFIX: "bisakerja-test",
  ASYNC_QUEUE_CONCURRENCY: "2",
  ASYNC_QUEUE_MAX_ATTEMPTS: "3",
  ASYNC_QUEUE_BACKOFF_MS: "100",
  ASYNC_QUEUE_RECOVERY_BATCH_SIZE: "20",
  ASYNC_QUEUE_RECOVERY_INTERVAL_MS: "1000",
  MODEL_API_BASE_URL: "http://localhost:8000",
  MODEL_API_TIMEOUT_MS: "10000",
  MODEL_API_SERVICE_TOKEN: "test-model-service-token",
  MODEL_API_ENABLE_MOCK: "true",
  AI_CV_ANALYZER_GENAI_ENABLED: "false",
  AI_CV_ANALYZER_GENAI_BASE_URL: "https://openrouter.ai/api/v1",
  AI_CV_ANALYZER_GENAI_MODEL: "openai/gpt-5.2",
  AI_CV_ANALYZER_GENAI_API_KEY: "test-ai-cv-analyzer-genai-key",
  AI_CV_ANALYZER_GENAI_TIMEOUT_MS: "6000",
  AI_CV_ANALYZER_GENAI_MAX_RETRIES: "0",
  SCRAPER_API_SERVICE_TOKEN: "test-scraper-service-token",
  GOOGLE_OAUTH_ENABLED: "false",
  GOOGLE_OAUTH_CLIENT_ID: "test-google-oauth-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-google-oauth-client-secret",
  GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:5173/auth/google/callback",
  FILE_STORAGE_DRIVER: "local",
  UPLOAD_STORAGE_PATH: "/tmp/bisakerja-api-test/uploads",
  CV_UPLOAD_MAX_BYTES: "5242880",
  CV_ALLOWED_MIME_TYPES: "application/pdf",
  CV_RETENTION_DAYS: "1",
  JOB_STALE_AFTER_HOURS: "72",
  LOG_LEVEL: "silent",
  REQUEST_ID_HEADER: "x-request-id",
  ENABLE_REQUEST_LOGGING: "false",
  HEALTH_CHECK_TIMEOUT_MS: "2000"
} satisfies NodeJS.ProcessEnv;

export const testSeedUserPassword =
  requireConfiguredTestEnv("SEED_USER_PASSWORD");

export function testConfig(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): AppConfig {
  return loadEnv({
    ...testEnv,
    ...overrides
  });
}
