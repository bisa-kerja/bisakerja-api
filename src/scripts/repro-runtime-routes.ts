import { createApp } from "@/app";
import { loadEnv } from "@/config/env";
import { prisma } from "@/shared/libs/prisma";
import { injectRoute } from "../../tests/helpers/route";

const config = loadEnv({
  ...process.env,
  APP_NAME: process.env.APP_NAME ?? "bisakerja-api",
  APP_ENV: process.env.APP_ENV ?? "local",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? "3000",
  API_PREFIX: process.env.API_PREFIX ?? "/api/v1",
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? "http://localhost:5173",
  TRUST_PROXY: process.env.TRUST_PROXY ?? "false",
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT ?? "5mb",
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS ?? "60000",
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ?? "120",
  AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX ?? "10",
  UPLOAD_RATE_LIMIT_MAX: process.env.UPLOAD_RATE_LIMIT_MAX ?? "10",
  AI_RATE_LIMIT_MAX: process.env.AI_RATE_LIMIT_MAX ?? "20",
  AUTH_ACCESS_TOKEN_SECRET:
    process.env.AUTH_ACCESS_TOKEN_SECRET ??
    "qGKY9NUPkF3uc7XyzqFGYRPSuYc5DkW1d6qUB9LCPVv1u5FCQPdaGDMPza50VKmH",
  AUTH_REFRESH_TOKEN_SECRET:
    process.env.AUTH_REFRESH_TOKEN_SECRET ??
    "eMLn7fn1bXcf97b9uru0YMPht9iERDHkqzJ36akDRfmCBM0ck03ru5Rwz61z1gYg",
  AUTH_ACCESS_TOKEN_TTL: process.env.AUTH_ACCESS_TOKEN_TTL ?? "15m",
  AUTH_REFRESH_TOKEN_TTL: process.env.AUTH_REFRESH_TOKEN_TTL ?? "7d",
  PASSWORD_RESET_TOKEN_TTL: process.env.PASSWORD_RESET_TOKEN_TTL ?? "15m",
  EMAIL_VERIFICATION_OTP_TTL:
    process.env.EMAIL_VERIFICATION_OTP_TTL ?? "15m",
  AUTH_REFRESH_COOKIE_NAME:
    process.env.AUTH_REFRESH_COOKIE_NAME ?? "bisakerja_refresh",
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE ?? "false",
  AUTH_COOKIE_SAME_SITE: process.env.AUTH_COOKIE_SAME_SITE ?? "lax",
  AUTH_ISSUER: process.env.AUTH_ISSUER ?? "bisakerja-api",
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE ?? "bisakerja-frontend",
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "fake",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "Bisakerja <no-reply@example.test>",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_MAX_RETRIES: process.env.RESEND_MAX_RETRIES ?? "0",
  MODEL_API_BASE_URL: process.env.MODEL_API_BASE_URL ?? "http://localhost:8000",
  MODEL_API_TIMEOUT_MS: process.env.MODEL_API_TIMEOUT_MS ?? "10000",
  MODEL_API_SERVICE_TOKEN: process.env.MODEL_API_SERVICE_TOKEN ?? "",
  MODEL_API_ENABLE_MOCK: process.env.MODEL_API_ENABLE_MOCK ?? "true",
  FILE_STORAGE_DRIVER: process.env.FILE_STORAGE_DRIVER ?? "local",
  UPLOAD_STORAGE_PATH: process.env.UPLOAD_STORAGE_PATH ?? "./storage/uploads",
  CV_UPLOAD_MAX_BYTES: process.env.CV_UPLOAD_MAX_BYTES ?? "5242880",
  CV_ALLOWED_MIME_TYPES:
    process.env.CV_ALLOWED_MIME_TYPES ?? "application/pdf",
  CV_RETENTION_DAYS: process.env.CV_RETENTION_DAYS ?? "1",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  REQUEST_ID_HEADER: process.env.REQUEST_ID_HEADER ?? "x-request-id",
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING ?? "true",
  HEALTH_CHECK_TIMEOUT_MS: process.env.HEALTH_CHECK_TIMEOUT_MS ?? "2000",
  PRISMA_LOG_LEVEL: process.env.PRISMA_LOG_LEVEL ?? "warn",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://app_user:replace-with-password@ep-test-breeze-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require",
  DIRECT_DATABASE_URL:
    process.env.DIRECT_DATABASE_URL ??
    "postgresql://app_user:replace-with-password@ep-test-breeze-a1b2c3d4.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require",
  JOB_STALE_AFTER_HOURS: process.env.JOB_STALE_AFTER_HOURS ?? "72"
});

const app = createApp(config);
const seedEmail = process.env.REPRO_SEED_EMAIL ?? "annisa.pratama@example.test";
const seedPassword = process.env.REPRO_SEED_PASSWORD ?? "Password123!";

type ResponseBody = {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

async function main() {
  const jobs = await injectRoute(app, {
    method: "GET",
    url: "/api/v1/jobs?page=1&limit=5",
    headers: { "x-request-id": "repro-jobs" }
  });

  assertStatus("JOBS", jobs, 200);
  console.log("JOBS", summarizeResponse(jobs));

  const login = await injectRoute(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { "x-request-id": "repro-login" },
    body: {
      identifier: seedEmail,
      password: seedPassword
    }
  });

  assertStatus("LOGIN", login, 200);
  console.log("LOGIN", summarizeResponse(login));

  const accessToken = (
    login.body as { data?: { session?: { accessToken?: string } } }
  ).data?.session?.accessToken;

  if (!accessToken) {
    throw new Error("Login did not return an access token.");
  }

  const bookmarks = await injectRoute(app, {
    method: "GET",
    url: "/api/v1/me/bookmarks?page=1&limit=10",
    headers: {
      "x-request-id": "repro-bookmarks",
      Authorization: `Bearer ${accessToken}`
    }
  });

  assertStatus("BOOKMARKS", bookmarks, 200);
  console.log("BOOKMARKS", summarizeResponse(bookmarks));

  const applications = await injectRoute(app, {
    method: "GET",
    url: "/api/v1/me/applications?page=1&limit=10",
    headers: {
      "x-request-id": "repro-applications",
      Authorization: `Bearer ${accessToken}`
    }
  });

  assertStatus("APPLICATIONS", applications, 200);
  console.log("APPLICATIONS", summarizeResponse(applications));
}

function assertStatus(
  label: string,
  response: Awaited<ReturnType<typeof injectRoute>>,
  expectedStatus: number
) {
  if (response.status === expectedStatus) {
    return;
  }

  const body = response.body as ResponseBody;
  throw new Error(
    `${label} expected ${String(expectedStatus)}, got ${String(response.status)}: ${
      body.error?.code ?? body.message ?? "unknown response"
    }`
  );
}

function summarizeResponse(response: Awaited<ReturnType<typeof injectRoute>>) {
  const body = response.body as ResponseBody;
  const data = body.data;

  return JSON.stringify({
    status: response.status,
    success: body.success,
    message: body.message,
    itemCount: Array.isArray(data) ? data.length : undefined
  });
}

main()
  .catch((error: unknown) => {
    console.error("REPRO_ERROR", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
