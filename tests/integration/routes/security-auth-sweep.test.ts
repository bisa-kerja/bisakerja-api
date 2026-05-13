import { describe, expect, test } from "bun:test";
import * as jwt from "jsonwebtoken";

import { createApp } from "@/app";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import type {
  AiCvAnalyzerRepository,
  CvFileStorage
} from "@/modules/ai-cv-analyzer";
import type { AiJobFitRepository } from "@/modules/ai-job-fit";
import type { AuthRepository } from "@/modules/auth";
import type { ApplicationsRepository } from "@/modules/applications";
import type { BookmarksRepository } from "@/modules/bookmarks";
import type { JobsRepository } from "@/modules/jobs";
import type { PreferencesRepository } from "@/modules/preferences";
import type { UsersRepository } from "@/modules/users";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";
import type { AsyncJobPublisher } from "@/shared/async-workloads";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const jobId = "11111111-1111-4111-8111-111111111111";

describe("protected route auth security sweep", () => {
  test("rejects missing bearer tokens across protected route groups", async () => {
    const app = createProtectedApp();

    for (const endpoint of protectedEndpoints) {
      const response = await requestProtectedEndpoint(app, endpoint, {
        "x-request-id": `req_missing_${endpoint.id}`
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          requestId: `req_missing_${endpoint.id}`
        }
      });
    }
  });

  test("rejects malformed authorization headers across protected route groups", async () => {
    const app = createProtectedApp();

    for (const endpoint of protectedEndpoints) {
      const response = await requestProtectedEndpoint(app, endpoint, {
        Authorization: "Token malformed",
        "x-request-id": `req_malformed_${endpoint.id}`
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          requestId: `req_malformed_${endpoint.id}`
        }
      });
    }
  });

  test("rejects invalid signed tokens across protected route groups", async () => {
    const app = createProtectedApp();

    for (const endpoint of protectedEndpoints) {
      const response = await requestProtectedEndpoint(app, endpoint, {
        Authorization: "Bearer invalid-token",
        "x-request-id": `req_invalid_${endpoint.id}`
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          requestId: `req_invalid_${endpoint.id}`
        }
      });
    }
  });

  test("rejects expired access tokens across protected route groups", async () => {
    const config = testConfig();
    const app = createProtectedApp(config);
    const expiredToken = jwt.sign(
      {
        type: "access",
        email: "user-1@example.test",
        username: "user-1"
      },
      config.auth.accessTokenSecret,
      {
        algorithm: "HS256",
        issuer: config.auth.issuer,
        audience: config.auth.audience,
        subject: "user-1",
        expiresIn: -10
      }
    );

    for (const endpoint of protectedEndpoints) {
      const response = await requestProtectedEndpoint(app, endpoint, {
        Authorization: `Bearer ${expiredToken}`,
        "x-request-id": `req_expired_${endpoint.id}`
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          requestId: `req_expired_${endpoint.id}`
        }
      });
    }
  });
});

type ProtectedEndpoint = {
  id: string;
  method?: "GET" | "POST";
  url: string;
  body?: Record<string, unknown>;
  formData?: FormData;
};

const protectedEndpoints: ProtectedEndpoint[] = [
  {
    id: "auth_logout",
    method: "POST",
    url: "/api/v1/auth/logout",
    body: {}
  },
  {
    id: "users_me",
    url: "/api/v1/me"
  },
  {
    id: "preferences_me",
    url: "/api/v1/me/preferences"
  },
  {
    id: "bookmarks_me",
    url: "/api/v1/me/bookmarks"
  },
  {
    id: "applications_me",
    url: "/api/v1/me/applications"
  },
  {
    id: "ai_job_fit",
    method: "POST",
    url: "/api/v1/ai/job-fit",
    body: { jobId }
  },
  {
    id: "ai_cv_analyzer",
    method: "POST",
    url: "/api/v1/ai/cv-analyzer",
    formData: buildCvFormData()
  }
];

function createProtectedApp(config = testConfig()) {
  const authMiddleware = createAuthMiddleware(
    config,
    createUnexpectedCallProxy() as AuthRepository
  );

  return createApp(config, {
    routes: {
      auth: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as AuthRepository,
        jobPublisher: fakeJobPublisher()
      },
      users: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as UsersRepository
      },
      preferences: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as PreferencesRepository
      },
      bookmarks: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as BookmarksRepository
      },
      applications: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as ApplicationsRepository
      },
      aiJobFit: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as AiJobFitRepository,
        modelApiClient: createUnexpectedCallProxy() as ModelApiClient
      },
      aiCvAnalyzer: {
        authMiddleware,
        repository: createUnexpectedCallProxy() as AiCvAnalyzerRepository,
        modelApiClient: createUnexpectedCallProxy() as ModelApiClient,
        storage: createUnexpectedCallProxy() as CvFileStorage
      },
      jobs: {
        repository: createUnexpectedCallProxy() as JobsRepository,
        now: () => new Date("2026-04-24T00:00:00.000Z")
      }
    }
  });
}

function fakeJobPublisher(): AsyncJobPublisher {
  return {
    publish: () => Promise.resolve(),
    publishPending: () => Promise.resolve(0),
    close: () => Promise.resolve()
  };
}

function createUnexpectedCallProxy() {
  return new Proxy(
    {},
    {
      get(_target, key) {
        return () => {
          throw new Error(`Unexpected call to ${String(key)}`);
        };
      }
    }
  );
}

function buildCvFormData() {
  const formData = new FormData();
  formData.set("jobId", jobId);
  formData.set("language", "id");
  formData.set("inputMode", "UPLOAD");
  formData.set("compareSource", "JOB_SEARCH");
  formData.set(
    "cvFile",
    new File([new Uint8Array([1, 2, 3])], "cv.pdf", {
      type: "application/pdf"
    })
  );
  return formData;
}

function requestProtectedEndpoint(
  app: Parameters<typeof injectRoute>[0],
  endpoint: ProtectedEndpoint,
  headers: Record<string, string>
) {
  return injectRoute(app, {
    method: endpoint.method,
    url: endpoint.url,
    headers,
    body: endpoint.body,
    formData: endpoint.formData
  });
}
