import { createApp } from "@/app";
import { prisma } from "@/shared/libs/prisma";
import {
  testConfig,
  testSeedUserPassword
} from "../../tests/helpers/config";
import { injectRoute } from "../../tests/helpers/route";

const config = testConfig({
  APP_ENV: "local",
  NODE_ENV: "development",
  LOG_LEVEL: "info",
  ENABLE_REQUEST_LOGGING: "true"
});

const app = createApp(config);
const seedEmail = "annisa.pratama@example.test";
const seedPassword = testSeedUserPassword;

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
