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
      "postgresql://postgres:postgres@localhost:5432/bisakerja_api_test",
    DIRECT_DATABASE_URL: "",
    PRISMA_LOG_LEVEL: "warn",
    CORS_ORIGINS: "http://localhost:5173",
    TRUST_PROXY: "false",
    REQUEST_BODY_LIMIT: "1mb",
    RATE_LIMIT_WINDOW_MS: "60000",
    RATE_LIMIT_MAX: "120",
    AUTH_RATE_LIMIT_MAX: "10",
    UPLOAD_RATE_LIMIT_MAX: "10",
    AI_RATE_LIMIT_MAX: "20",
    LOG_LEVEL: "silent",
    REQUEST_ID_HEADER: "x-request-id",
    ENABLE_REQUEST_LOGGING: "false",
    HEALTH_CHECK_TIMEOUT_MS: "2000",
    ...overrides
  });
}
