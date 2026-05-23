import type { RequestHandler } from "express";
import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { AuthenticationError } from "@/core/errors/app.error";
import type {
  AiCvAnalyzerRepository,
  CvAnalysisSnapshotInput,
  CvFileMetadataRecord
} from "@/modules/ai-cv-analyzer";
import type { AuthRequestContext } from "@/modules/auth";
import type { CvGenerateModelPayload } from "@/shared/integrations/model-api.schema";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const userId = "user-1";
const cvFileId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-05-23T00:00:00.000Z");

const ownedCvFile: CvFileMetadataRecord = {
  id: cvFileId,
  userId,
  originalFileName: "cv.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1234,
  storageDriver: "LOCAL",
  storageKey: "cv/user-1/file.pdf",
  isActive: true,
  uploadedAt: now,
  expiresAt: new Date("2026-05-24T00:00:00.000Z"),
  deletedAt: null
};

describe("ai cv generate route", () => {
  test("generates markdown HTML response through authenticated route", async () => {
    let modelPayload: unknown;
    const { app } = createAiCvGenerateRouteContext({
      generateCvMarkdown: (payload) => {
        modelPayload = payload;
        return Promise.resolve({
          markdown: "<section><h1>Nama Kandidat</h1></section>"
        });
      }
    });

    const response = await injectRoute(app, {
      method: "POST",
      url: "/api/v1/ai/cv-generate",
      headers: authHeaders(userId, "req_cv_generate_success"),
      body: validBody()
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      message: "Markdown CV berhasil dibuat",
      data: {
        markdown: "<section><h1>Nama Kandidat</h1></section>"
      },
      meta: null
    });
    expect(modelPayload).toMatchObject({
      requestId: "req_cv_generate_success",
      inputVersion: "cv-generate-v1",
      cv: {
        fileId: cvFileId,
        storageKey: ownedCvFile.storageKey
      },
      summary: "Kandidat backend dengan pengalaman REST API.",
      template: {
        markdown: null,
        html: "<section><h1>{{name}}</h1><p>{{summary}}</p></section>"
      }
    });
  });

  test("requires authentication", async () => {
    const { app } = createAiCvGenerateRouteContext();

    const response = await injectRoute(app, {
      method: "POST",
      url: "/api/v1/ai/cv-generate",
      headers: { "x-request-id": "req_cv_generate_auth" },
      body: validBody()
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_cv_generate_auth"
      }
    });
  });

  test("validates required HTML template", async () => {
    const { app } = createAiCvGenerateRouteContext();

    const response = await injectRoute(app, {
      method: "POST",
      url: "/api/v1/ai/cv-generate",
      headers: authHeaders(userId, "req_cv_generate_validation"),
      body: {
        cvFileId,
        summary: "Kandidat backend"
      }
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        requestId: "req_cv_generate_validation"
      }
    });
  });

  test("conceals cross-user CV and does not call Model API", async () => {
    let modelCalled = false;
    const { app } = createAiCvGenerateRouteContext({
      fileMetadata: [{ ...ownedCvFile, userId: "other-user" }],
      generateCvMarkdown: () => {
        modelCalled = true;
        return Promise.resolve({
          markdown: "<section>Should not happen</section>"
        });
      }
    });

    const response = await injectRoute(app, {
      method: "POST",
      url: "/api/v1/ai/cv-generate",
      headers: authHeaders(userId, "req_cv_generate_cross_user"),
      body: validBody()
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "CV_FILE_NOT_FOUND",
        requestId: "req_cv_generate_cross_user"
      }
    });
    expect(modelCalled).toBe(false);
  });

  test("rejects unsafe model output", async () => {
    const { app } = createAiCvGenerateRouteContext({
      generateCvMarkdown: () =>
        Promise.resolve({
          markdown: "<section>CV</section><script>alert(1)</script>"
        })
    });

    const response = await injectRoute(app, {
      method: "POST",
      url: "/api/v1/ai/cv-generate",
      headers: authHeaders(userId, "req_cv_generate_unsafe"),
      body: validBody()
    });

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "MODEL_OUTPUT_INVALID",
        requestId: "req_cv_generate_unsafe"
      }
    });
  });
});

function createAiCvGenerateRouteContext(
  overrides: {
    fileMetadata?: CvFileMetadataRecord[];
    generateCvMarkdown?: (
      payload: CvGenerateModelPayload
    ) => Promise<{ markdown: string }>;
  } = {}
) {
  const repository = new InMemoryAiCvAnalyzerRepository(
    overrides.fileMetadata ?? [ownedCvFile]
  );

  const app = createApp(testConfig({ MODEL_API_ENABLE_MOCK: "false" }), {
    routes: {
      aiCvGenerate: {
        repository,
        authMiddleware: createTestAuthMiddleware(),
        modelApiClient: {
          analyzeJobFit: () => Promise.reject(new Error("Not used")),
          analyzeCv: () => Promise.reject(new Error("Not used")),
          generateCvMarkdown: (payload) => {
            if (overrides.generateCvMarkdown) {
              return overrides.generateCvMarkdown(payload);
            }

            return Promise.resolve({
              markdown: "<section>Generated CV</section>"
            });
          }
        },
        now: () => now
      }
    }
  });

  return { app, repository };
}

class InMemoryAiCvAnalyzerRepository implements AiCvAnalyzerRepository {
  readonly snapshots: CvAnalysisSnapshotInput[] = [];

  constructor(private readonly fileMetadata: CvFileMetadataRecord[]) {}

  createCvFileMetadata(): Promise<CvFileMetadataRecord> {
    return Promise.resolve(ownedCvFile);
  }

  findActiveCvFileMetadata(): Promise<CvFileMetadataRecord | null> {
    return Promise.resolve(this.fileMetadata[0] ?? null);
  }

  findCvFileMetadataById(
    id: string,
    at: Date
  ): Promise<CvFileMetadataRecord | null> {
    const record = this.fileMetadata.find(
      (item) =>
        item.id === id &&
        item.deletedAt === null &&
        item.expiresAt.getTime() > at.getTime()
    );

    return Promise.resolve(record ?? null);
  }

  markCvFileDeleted(): Promise<void> {
    return Promise.resolve();
  }

  createSnapshot(input: CvAnalysisSnapshotInput): Promise<void> {
    this.snapshots.push(input);
    return Promise.resolve();
  }

  findExpiredActiveCvFiles(): Promise<[]> {
    return Promise.resolve([]);
  }

  markCvFilesDeleted(): Promise<number> {
    return Promise.resolve(0);
  }
}

function createTestAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    const header = req.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      next(new AuthenticationError());
      return;
    }

    const authUserId = header.slice("Bearer ".length).trim();
    const user: AuthRequestContext["user"] = {
      id: authUserId,
      username: authUserId,
      email: `${authUserId}@example.test`,
      emailVerified: true,
      onboardingStatus: "COMPLETED",
      createdAt: now
    };

    req.auth = { userId: authUserId, user };
    next();
  };
}

function authHeaders(authUserId: string, requestId: string) {
  return {
    authorization: `Bearer ${authUserId}`,
    "x-request-id": requestId
  };
}

function validBody() {
  return {
    cvFileId,
    summary: "Kandidat backend dengan pengalaman REST API.",
    templateHtml: "<section><h1>{{name}}</h1><p>{{summary}}</p></section>"
  };
}
