import type { RequestHandler } from "express";
import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { AuthenticationError } from "@/core/errors/app.error";
import type {
  AiCvAnalyzerRepository,
  CvAnalysisSnapshotInput,
  CvFileMetadataRecord,
  CvFileStorage
} from "@/modules/ai-cv-analyzer";
import type { AiCvGenerateGenAiInput } from "@/modules/ai-cv-generate";
import type { AuthRequestContext } from "@/modules/auth";
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
    let providerInput: unknown;
    const { app } = createAiCvGenerateRouteContext({
      generateMarkdown: (input) => {
        providerInput = input;
        return Promise.resolve(
          "<section><h1>Candidate Name</h1><p>Backend candidate with REST API experience.</p></section>"
        );
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
      message: "Markdown CV created successfully",
      data: {
        markdown:
          "<section><h1>Candidate Name</h1><p>Backend candidate with REST API experience.</p></section>"
      },
      meta: null
    });
    expect(providerInput).toMatchObject({
      requestId: "req_cv_generate_success",
      inputVersion: "cv-generate-v2",
      summary: "Backend candidate with REST API experience.",
      templateHtml: "<section><h1>{{name}}</h1><p>{{summary}}</p></section>",
      evidence: {
        cvFile: { fileId: cvFileId },
        currentCv: {
          candidateSummary: "Route test CV evidence",
          contactRedactionPolicy: "contact_data_removed"
        }
      }
    });
    expect(JSON.stringify(providerInput)).not.toContain(ownedCvFile.storageKey);
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
        summary: "Backend candidate"
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
    let providerCalled = false;
    const { app } = createAiCvGenerateRouteContext({
      fileMetadata: [{ ...ownedCvFile, userId: "other-user" }],
      generateMarkdown: () => {
        providerCalled = true;
        return Promise.resolve("<section>Should not happen</section>");
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
    expect(providerCalled).toBe(false);
  });

  test("keeps Generate provider disabled when only Analyzer wrapper flag is enabled", async () => {
    let providerCalled = false;
    const { app } = createAiCvGenerateRouteContext({
      configOverrides: {
        AI_CV_ANALYZER_GENAI_ENABLED: "true",
        AI_CV_GENERATE_GENAI_ENABLED: "false"
      },
      generateMarkdown: () => {
        providerCalled = true;
        return Promise.resolve("<section>Should not happen</section>");
      }
    });

    const response = await injectRoute(app, {
      method: "POST",
      url: "/api/v1/ai/cv-generate",
      headers: authHeaders(userId, "req_cv_generate_disabled"),
      body: validBody()
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        requestId: "req_cv_generate_disabled"
      }
    });
    expect(providerCalled).toBe(false);
  });

  test("rejects unsafe model output", async () => {
    const { app } = createAiCvGenerateRouteContext({
      generateMarkdown: () =>
        Promise.resolve("<section>CV</section><script>alert(1)</script>")
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
    configOverrides?: Parameters<typeof testConfig>[0];
    fileMetadata?: CvFileMetadataRecord[];
    generateMarkdown?: (input: AiCvGenerateGenAiInput) => Promise<string>;
    readFile?: CvFileStorage["readFile"];
  } = {}
) {
  const repository = new InMemoryAiCvAnalyzerRepository(
    overrides.fileMetadata ?? [ownedCvFile]
  );

  const app = createApp(
    testConfig({
      MODEL_API_ENABLE_MOCK: "false",
      AI_CV_GENERATE_GENAI_ENABLED: "true",
      ...overrides.configOverrides
    }),
    {
      routes: {
        aiCvGenerate: {
          repository,
          authMiddleware: createTestAuthMiddleware(),
          storage: {
            saveFile: () =>
              Promise.resolve({
                storageDriver: "LOCAL",
                storageKey: ownedCvFile.storageKey
              }),
            deleteFile: () => Promise.resolve(),
            readFile:
              overrides.readFile ??
              (() =>
                Promise.resolve(Buffer.from("Summary\nRoute test CV evidence")))
          },
          genAiClient: {
            generateMarkdown: (input) => {
              if (overrides.generateMarkdown) {
                return overrides.generateMarkdown(input);
              }

              return Promise.resolve("<section>Generated CV</section>");
            }
          },
          now: () => now
        }
      }
    }
  );

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

  createSnapshot(input: CvAnalysisSnapshotInput): Promise<string> {
    this.snapshots.push(input);
    return Promise.resolve("11111111-1111-4111-8111-111111111115");
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
    summary: "Backend candidate with REST API experience.",
    templateHtml: "<section><h1>{{name}}</h1><p>{{summary}}</p></section>"
  };
}
