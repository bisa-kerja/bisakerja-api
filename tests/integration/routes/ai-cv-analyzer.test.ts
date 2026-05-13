import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import {
  AuthenticationError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import type {
  AiCvAnalyzerRepository,
  CvAnalysisSnapshotInput,
  CvFileMetadataRecord,
  CvFileStorage,
  UploadedCvFile
} from "@/modules/ai-cv-analyzer";
import type { AuthUser } from "@/modules/auth";
import type { JobRecord, JobsRepository } from "@/modules/jobs";
import { modelApiFixtures } from "../../fixtures/model-api";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("ai cv analyzer routes", () => {
  test("requires authentication", async () => {
    const context = createAiCvAnalyzerRouteContext();

    const formData = buildCvFormData();
    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: { "x-request-id": "req_ai_cv_no_auth" },
      formData
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_ai_cv_no_auth"
      }
    });
  });

  test("rejects non-multipart requests and missing files", async () => {
    const context = createAiCvAnalyzerRouteContext();

    const nonMultipartResponse = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_non_multipart"),
      body: {
        jobId: jobRecord().id,
        language: "id",
        inputMode: "UPLOAD"
      }
    });
    const missingFileResponse = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_missing_file"),
      formData: buildCvFormData({ includeFile: false })
    });

    expect(nonMultipartResponse.status).toBe(422);
    expect(missingFileResponse.status).toBe(422);
    expect(missingFileResponse.body).toMatchObject({
      error: { code: "VALIDATION_ERROR" }
    });
  });

  test("rejects unsupported mime type, oversized files, unsupported reference mode, and unsafe bookmark access", async () => {
    const invalidMimeContext = createAiCvAnalyzerRouteContext();
    const invalidMimeResponse = await injectRoute(invalidMimeContext.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_invalid_mime"),
      formData: buildCvFormData({
        file: new File(["hello"], "cv.txt", { type: "text/plain" })
      })
    });

    const oversizedContext = createAiCvAnalyzerRouteContext({
      config: testConfig({
        CV_UPLOAD_MAX_BYTES: "8"
      })
    });
    const oversizedResponse = await injectRoute(oversizedContext.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_oversized"),
      formData: buildCvFormData({
        file: new File([new Uint8Array(32)], "cv.pdf", {
          type: "application/pdf"
        })
      })
    });

    const referenceContext = createAiCvAnalyzerRouteContext();
    const referenceResponse = await injectRoute(referenceContext.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_reference"),
      formData: buildCvFormData({
        includeFile: false,
        overrides: {
          inputMode: "REFERENCE",
          cvFileId: "22222222-2222-4222-8222-222222222222"
        }
      })
    });

    const bookmarkContext = createAiCvAnalyzerRouteContext({
      hasBookmark: false
    });
    const bookmarkResponse = await injectRoute(bookmarkContext.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_bookmark_missing"),
      formData: buildCvFormData({
        overrides: {
          compareSource: "BOOKMARK"
        }
      })
    });

    expect(invalidMimeResponse.status).toBe(422);
    expect(oversizedResponse.status).toBe(413);
    expect(referenceResponse.status).toBe(422);
    expect(bookmarkResponse.status).toBe(404);
    expect(bookmarkResponse.body).toMatchObject({
      error: { code: "BOOKMARK_NOT_FOUND" }
    });
  });

  test("returns success, persists when requested, and does not leak internal payload fields", async () => {
    const context = createAiCvAnalyzerRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_success"),
      formData: buildCvFormData({
        overrides: {
          persistResult: "true"
        }
      })
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Analisis CV berhasil diselesaikan",
      data: {
        jobId: jobRecord().id,
        language: "id",
        generatedCv: {
          available: false
        }
      },
      meta: null
    });
    expect(context.repository.snapshots).toHaveLength(1);
    expect(context.storage.savedFiles).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain("storageKey");
    expect(JSON.stringify(response.body)).not.toContain("requestId");
  });

  test("isolates ai failure from jobs routes", async () => {
    const context = createAiCvAnalyzerRouteContext({
      analyzeCv: () =>
        Promise.reject(new ServiceUnavailableError("Model API tidak tersedia"))
    });

    const aiResponse = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeaders("user-1", "req_ai_cv_failure"),
      formData: buildCvFormData()
    });
    const jobsResponse = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs",
      headers: { "x-request-id": "req_jobs_after_ai_cv_failure" }
    });

    expect(aiResponse.status).toBe(503);
    expect(aiResponse.body).toMatchObject({
      error: {
        code: "SERVICE_UNAVAILABLE",
        requestId: "req_ai_cv_failure"
      }
    });
    expect(jobsResponse.status).toBe(200);
    expect(jobsResponse.body).toMatchObject({
      success: true,
      data: [
        {
          id: jobRecord().id,
          title: "Backend Developer"
        }
      ]
    });
  });
});

function createAiCvAnalyzerRouteContext(
  overrides: {
    hasBookmark?: boolean;
    job?: JobRecord | null;
    analyzeCv?: () => Promise<typeof modelApiFixtures.validCvAnalyzerResponse>;
    config?: ReturnType<typeof testConfig>;
  } = {}
) {
  const repository = new InMemoryAiCvAnalyzerRepository(
    overrides.job ?? jobRecord(),
    overrides.hasBookmark ?? true
  );
  const storage = new InMemoryCvFileStorage();
  const jobsRepository = new StaticJobsRepository(
    overrides.job ? [overrides.job] : [jobRecord()]
  );
  const authMiddleware = createTestAuthMiddleware();
  const config =
    overrides.config ?? testConfig({ MODEL_API_ENABLE_MOCK: "false" });

  const app = createApp(config, {
    routes: {
      aiCvAnalyzer: {
        repository,
        authMiddleware,
        storage,
        modelApiClient: {
          analyzeJobFit: () => Promise.reject(new Error("Not used")),
          analyzeCv: () => {
            if (overrides.analyzeCv) {
              return overrides.analyzeCv();
            }

            return Promise.resolve(modelApiFixtures.validCvAnalyzerResponse);
          }
        },
        now: () => new Date("2026-04-23T00:00:00.000Z")
      },
      jobs: {
        repository: jobsRepository,
        now: () => new Date("2026-04-23T00:00:00.000Z")
      }
    }
  });

  return { app, repository, storage };
}

class InMemoryAiCvAnalyzerRepository implements AiCvAnalyzerRepository {
  readonly fileMetadata: CvFileMetadataRecord[] = [];
  readonly snapshots: CvAnalysisSnapshotInput[] = [];

  constructor(
    private readonly job: JobRecord | null,
    private readonly hasBookmark: boolean
  ) {}

  findVisibleJob(): Promise<JobRecord | null> {
    return Promise.resolve(this.job);
  }

  hasOwnedBookmarkForJob(): Promise<boolean> {
    return Promise.resolve(this.hasBookmark);
  }

  createCvFileMetadata(
    input: Parameters<AiCvAnalyzerRepository["createCvFileMetadata"]>[0]
  ): Promise<CvFileMetadataRecord> {
    const record: CvFileMetadataRecord = {
      ...input,
      storageDriver: "LOCAL",
      uploadedAt: new Date("2026-04-23T00:00:00.000Z"),
      deletedAt: null
    };

    this.fileMetadata.push(record);
    return Promise.resolve(record);
  }

  markCvFileDeleted(): Promise<void> {
    return Promise.resolve();
  }

  createSnapshot(input: CvAnalysisSnapshotInput): Promise<void> {
    this.snapshots.push(structuredClone(input));
    return Promise.resolve();
  }

  findExpiredActiveCvFiles() {
    return Promise.resolve([]);
  }

  markCvFilesDeleted() {
    return Promise.resolve(0);
  }
}

class InMemoryCvFileStorage implements CvFileStorage {
  readonly savedFiles: UploadedCvFile[] = [];

  saveFile(input: {
    userId: string;
    fileId: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    this.savedFiles.push({
      originalName: `${input.fileId}.pdf`,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      buffer: input.buffer
    });

    return Promise.resolve({
      storageDriver: "LOCAL" as const,
      storageKey: `cv/${input.userId}/${input.fileId}.pdf`
    });
  }

  deleteFile(): Promise<void> {
    return Promise.resolve();
  }
}

class StaticJobsRepository implements JobsRepository {
  constructor(private readonly jobs: JobRecord[]) {}

  listJobs() {
    return Promise.resolve({ items: this.jobs, total: this.jobs.length });
  }

  findVisibleById(jobId: string): Promise<JobRecord | null> {
    return Promise.resolve(this.jobs.find((job) => job.id === jobId) ?? null);
  }
}

function authHeaders(
  userId: string,
  requestId: string
): Record<string, string> {
  return {
    Authorization: `Bearer ${userId}`,
    "x-request-id": requestId
  };
}

function createTestAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    const header = req.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      next(new AuthenticationError());
      return;
    }

    const userId = header.slice("Bearer ".length).trim();
    const user: AuthUser = {
      id: userId,
      username: userId,
      email: `${userId}@example.test`,
      emailVerified: true,
      onboardingStatus: "COMPLETED",
      createdAt: new Date("2026-04-23T00:00:00.000Z")
    };

    req.auth = { userId, user };
    next();
  };
}

function buildCvFormData(
  options: {
    includeFile?: boolean;
    file?: File;
    overrides?: Record<string, string>;
  } = {}
) {
  const formData = new FormData();
  const includeFile = options.includeFile ?? true;

  formData.set("jobId", jobRecord().id);
  formData.set("language", options.overrides?.language ?? "id");
  formData.set("inputMode", options.overrides?.inputMode ?? "UPLOAD");
  formData.set(
    "compareSource",
    options.overrides?.compareSource ?? "JOB_SEARCH"
  );

  if (options.overrides?.persistResult) {
    formData.set("persistResult", options.overrides.persistResult);
  }

  if (options.overrides?.cvFileId) {
    formData.set("cvFileId", options.overrides.cvFileId);
  }

  if (includeFile) {
    formData.set(
      "cvFile",
      options.file ??
        new File([Buffer.from("%PDF-1.4 route test")], "cv.pdf", {
          type: "application/pdf"
        })
    );
  }

  return formData;
}

function jobRecord(): JobRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description: "Build APIs.",
    requirementSummary: "TypeScript",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: {
      display: "Jakarta Selatan, DKI Jakarta",
      province: "DKI Jakarta",
      city: "Jakarta Selatan"
    },
    salary: {
      min: 5_000_000,
      max: 10_000_000,
      currency: "IDR",
      period: "MONTHLY",
      display: null
    },
    sourceUrl: "https://example.test/job",
    externalApplyUrl: "https://example.test/apply",
    postedAt: new Date("2026-04-20T00:00:00.000Z"),
    sourceUpdatedAt: null,
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-22T00:00:00.000Z"),
    company: {
      id: "company-1",
      name: "Nusantara Tech",
      logoUrl: null,
      websiteUrl: null
    },
    sourcePlatform: { id: "source-1", name: "Glints", slug: "glints" },
    requirements: [
      {
        type: "SKILL",
        value: "TypeScript",
        priority: null,
        sortOrder: 0
      }
    ],
    skills: [{ name: "TypeScript" }]
  };
}
