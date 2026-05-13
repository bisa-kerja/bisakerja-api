import { describe, expect, test } from "bun:test";

import {
  AiCvAnalyzerService,
  buildCvAnalyzerPayload,
  cleanupExpiredCvFiles,
  createCvExpiryDate,
  mapCvAnalysisResource,
  sanitizeOriginalFileName
} from "@/modules/ai-cv-analyzer";
import type {
  AiCvAnalyzerRepository,
  CleanupExpiredCvFilesResult,
  CvAnalysisSnapshotInput,
  CvFileMetadataRecord,
  CvFileStorage,
  ExpiredCvFileRecord,
  UploadedCvFile
} from "@/modules/ai-cv-analyzer";
import type { JobRecord } from "@/modules/jobs";
import { modelApiFixtures } from "../../fixtures/model-api";

describe("AiCvAnalyzerService", () => {
  test("builds backend-owned payload and product-safe resource", () => {
    const metadata = cvFileMetadataRecord();
    const payload = buildCvAnalyzerPayload(
      "req_cv_payload",
      {
        jobId: jobRecord().id,
        language: "id",
        inputMode: "UPLOAD",
        compareSource: "JOB_SEARCH",
        persistResult: false
      },
      metadata,
      jobRecord()
    );
    const resource = mapCvAnalysisResource(
      jobRecord().id,
      "id",
      modelApiFixtures.validCvAnalyzerResponse
    );

    expect(payload).toMatchObject({
      requestId: "req_cv_payload",
      inputVersion: "cv-analyzer-v1",
      language: "ID",
      cv: {
        fileId: metadata.id,
        storageKey: metadata.storageKey
      }
    });
    expect(resource).toMatchObject({
      jobId: jobRecord().id,
      language: "id",
      generatedCv: {
        available: false
      }
    });
  });

  test("stores metadata, persists snapshots only when requested, and sanitizes filenames", async () => {
    const repository = new InMemoryAiCvAnalyzerRepository();
    const storage = new InMemoryCvFileStorage();
    const service = new AiCvAnalyzerService(repository, {
      modelApiClient: {
        analyzeJobFit: () => Promise.reject(new Error("Not used")),
        analyzeCv: () =>
          Promise.resolve(modelApiFixtures.validCvAnalyzerResponse)
      },
      storage,
      cvRetentionDays: 1,
      now: () => new Date("2026-04-23T00:00:00.000Z")
    });

    const result = await service.analyzeCv(
      "user-1",
      "req_cv_success",
      {
        jobId: jobRecord().id,
        language: "id",
        inputMode: "UPLOAD",
        compareSource: "JOB_SEARCH",
        persistResult: true
      },
      uploadedCvFile("../My CV 2026.pdf")
    );

    expect(result.persisted).toBe(true);
    expect(repository.fileMetadata).toHaveLength(1);
    expect(repository.fileMetadata[0]?.originalFileName).toBe("My_CV_2026.pdf");
    expect(repository.snapshots).toHaveLength(1);
    expect(storage.savedFiles).toHaveLength(1);
  });

  test("returns safe validation and ownership errors, and cleans up uploaded file on downstream failure", async () => {
    const missingBookmarkRepository = new InMemoryAiCvAnalyzerRepository({
      hasBookmark: false
    });
    const missingBookmarkService = new AiCvAnalyzerService(
      missingBookmarkRepository,
      {
        modelApiClient: {
          analyzeJobFit: () => Promise.reject(new Error("Not used")),
          analyzeCv: () =>
            Promise.resolve(modelApiFixtures.validCvAnalyzerResponse)
        },
        storage: new InMemoryCvFileStorage(),
        cvRetentionDays: 1
      }
    );

    try {
      await missingBookmarkService.analyzeCv(
        "user-1",
        "req_cv_bookmark_missing",
        {
          jobId: jobRecord().id,
          language: "id",
          inputMode: "UPLOAD",
          compareSource: "BOOKMARK",
          persistResult: false
        },
        uploadedCvFile()
      );
      throw new Error("Expected bookmark ownership failure");
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 404,
        code: "BOOKMARK_NOT_FOUND"
      });
    }

    const cleanupRepository = new InMemoryAiCvAnalyzerRepository();
    const cleanupStorage = new InMemoryCvFileStorage();
    const cleanupService = new AiCvAnalyzerService(cleanupRepository, {
      modelApiClient: {
        analyzeJobFit: () => Promise.reject(new Error("Not used")),
        analyzeCv: () => Promise.reject(new Error("Model API unavailable"))
      },
      storage: cleanupStorage,
      cvRetentionDays: 1,
      now: () => new Date("2026-04-23T00:00:00.000Z")
    });

    try {
      await cleanupService.analyzeCv(
        "user-1",
        "req_cv_cleanup_failure",
        {
          jobId: jobRecord().id,
          language: "id",
          inputMode: "UPLOAD",
          compareSource: "JOB_SEARCH",
          persistResult: false
        },
        uploadedCvFile()
      );
      throw new Error("Expected downstream failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Model API unavailable");
    }
    expect(cleanupStorage.deletedStorageKeys).toHaveLength(1);
    expect(cleanupRepository.deletedFileIds).toHaveLength(1);
  });

  test("cleans up expired stored CV files and reports failures", async () => {
    const repository = new InMemoryAiCvAnalyzerRepository({
      expiredFiles: [
        { id: "file-1", storageKey: "cv/user-1/file-1.pdf" },
        { id: "file-2", storageKey: "cv/user-1/file-2.pdf" }
      ]
    });
    const storage = new InMemoryCvFileStorage({
      failDeletesFor: ["cv/user-1/file-2.pdf"]
    });

    const result = await cleanupExpiredCvFiles(
      repository,
      storage,
      new Date("2026-04-23T00:00:00.000Z")
    );

    expect(result).toEqual<CleanupExpiredCvFilesResult>({
      processed: 2,
      deleted: 1,
      failed: 1
    });
    expect(repository.deletedFileIds).toEqual(["file-1"]);
  });

  test("creates predictable expiry dates and sanitized filenames", () => {
    expect(
      createCvExpiryDate(new Date("2026-04-23T00:00:00.000Z"), 2).toISOString()
    ).toBe("2026-04-25T00:00:00.000Z");
    expect(sanitizeOriginalFileName("../../Senior CV (Final).pdf")).toBe(
      "Senior_CV__Final_.pdf"
    );
  });
});

class InMemoryAiCvAnalyzerRepository implements AiCvAnalyzerRepository {
  readonly fileMetadata: CvFileMetadataRecord[] = [];
  readonly snapshots: CvAnalysisSnapshotInput[] = [];
  readonly deletedFileIds: string[] = [];

  constructor(
    private readonly state: {
      job?: JobRecord | null;
      hasBookmark?: boolean;
      expiredFiles?: ExpiredCvFileRecord[];
    } = {}
  ) {}

  findVisibleJob(): Promise<JobRecord | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "job") ? (this.state.job ?? null) : jobRecord()
    );
  }

  hasOwnedBookmarkForJob(): Promise<boolean> {
    return Promise.resolve(this.state.hasBookmark ?? true);
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

  markCvFileDeleted(fileId: string): Promise<void> {
    this.deletedFileIds.push(fileId);
    return Promise.resolve();
  }

  createSnapshot(input: CvAnalysisSnapshotInput): Promise<void> {
    this.snapshots.push(structuredClone(input));
    return Promise.resolve();
  }

  findExpiredActiveCvFiles(): Promise<ExpiredCvFileRecord[]> {
    return Promise.resolve(this.state.expiredFiles ?? []);
  }

  markCvFilesDeleted(fileIds: string[]): Promise<number> {
    this.deletedFileIds.push(...fileIds);
    return Promise.resolve(fileIds.length);
  }
}

class InMemoryCvFileStorage implements CvFileStorage {
  readonly savedFiles: {
    fileId: string;
    storageKey: string;
    sizeBytes: number;
  }[] = [];
  readonly deletedStorageKeys: string[] = [];

  constructor(
    private readonly state: {
      failDeletesFor?: string[];
    } = {}
  ) {}

  saveFile(input: {
    userId: string;
    fileId: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    const storageKey = `cv/${input.userId}/${input.fileId}.pdf`;
    this.savedFiles.push({
      fileId: input.fileId,
      storageKey,
      sizeBytes: input.buffer.length
    });

    return Promise.resolve({
      storageDriver: "LOCAL" as const,
      storageKey
    });
  }

  deleteFile(storageKey: string): Promise<void> {
    if (this.state.failDeletesFor?.includes(storageKey)) {
      return Promise.reject(new Error("delete failed"));
    }

    this.deletedStorageKeys.push(storageKey);
    return Promise.resolve();
  }
}

function uploadedCvFile(originalName = "cv.pdf"): UploadedCvFile {
  return {
    originalName,
    mimeType: "application/pdf",
    sizeBytes: 16,
    buffer: Buffer.from("%PDF-1.4 test cv")
  };
}

function cvFileMetadataRecord(): CvFileMetadataRecord {
  return {
    id: "cv-file-1",
    userId: "user-1",
    originalFileName: "cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 16,
    storageDriver: "LOCAL",
    storageKey: "cv/user-1/cv-file-1.pdf",
    uploadedAt: new Date("2026-04-23T00:00:00.000Z"),
    expiresAt: new Date("2026-04-24T00:00:00.000Z"),
    deletedAt: null
  };
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
