import { NotFoundError, ValidationError } from "@/core/errors/app.error";
import {
  aiCvAnalyzerErrorCodes,
  generatedCvUnavailableNote
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.constants";
import type { AnalyzeCvInput } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.schema";
import type {
  AiCvAnalyzerRepository,
  AiCvAnalyzerServiceOptions,
  CleanupExpiredCvFilesResult,
  CvAnalysisResource,
  CvAnalysisResult,
  CvFileMetadataRecord,
  CvFileStorage,
  UploadedCvFile
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";
import { jobsErrorCodes } from "@/modules/jobs/jobs.constants";
import type { JobRecord } from "@/modules/jobs";
import type {
  CvAnalyzerModelPayload,
  CvAnalyzerModelResponse
} from "@/shared/integrations/model-api.schema";

export class AiCvAnalyzerService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: AiCvAnalyzerRepository,
    private readonly options: AiCvAnalyzerServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async analyzeCv(
    userId: string,
    requestId: string,
    input: AnalyzeCvInput,
    uploadedFile: UploadedCvFile | null
  ): Promise<CvAnalysisResult> {
    if (input.inputMode === "REFERENCE") {
      throw createValidationError("REFERENCE mode is not supported yet", [
        {
          path: "inputMode",
          message: "REFERENCE mode is not supported yet",
          code: "custom"
        }
      ]);
    }

    if (!uploadedFile) {
      throw createValidationError("CV file is required", [
        {
          path: "cvFile",
          message: "A PDF CV file is required for analysis",
          code: "custom"
        }
      ]);
    }

    const [job, hasOwnedBookmark] = await Promise.all([
      this.repository.findVisibleJob(input.jobId),
      input.compareSource === "BOOKMARK"
        ? this.repository.hasOwnedBookmarkForJob(userId, input.jobId)
        : Promise.resolve(true)
    ]);

    if (!job) {
      throw new NotFoundError("Job not found", jobsErrorCodes.jobNotFound);
    }

    if (!hasOwnedBookmark) {
      throw new NotFoundError(
        "Bookmark not found",
        aiCvAnalyzerErrorCodes.bookmarkNotFound
      );
    }

    const fileId = crypto.randomUUID();
    const storedFile = await this.options.storage.saveFile({
      userId,
      fileId,
      mimeType: uploadedFile.mimeType,
      buffer: uploadedFile.buffer
    });
    let metadata: CvFileMetadataRecord | null = null;

    try {
      metadata = await this.repository.createCvFileMetadata({
        id: fileId,
        userId,
        originalFileName: sanitizeOriginalFileName(uploadedFile.originalName),
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.sizeBytes,
        storageDriver: storedFile.storageDriver,
        storageKey: storedFile.storageKey,
        expiresAt: createCvExpiryDate(this.now(), this.options.cvRetentionDays)
      });

      const payload = buildCvAnalyzerPayload(requestId, input, metadata, job);
      const response = await this.options.modelApiClient.analyzeCv(payload);
      const persisted = input.persistResult;

      if (persisted) {
        await this.repository.createSnapshot({
          userId,
          jobId: job.id,
          cvFileMetadataId: metadata.id,
          language: toModelLanguage(input.language),
          inputMode: input.inputMode,
          compareSource: input.compareSource,
          payload,
          response
        });
      }

      return {
        resource: mapCvAnalysisResource(job.id, input.language, response),
        persisted,
        cvFileMetadataId: metadata.id
      };
    } catch (error) {
      await cleanupUploadedFile(
        this.repository,
        this.options.storage,
        metadata?.id ?? fileId,
        storedFile.storageKey,
        this.now()
      );
      throw error;
    }
  }
}

export async function cleanupExpiredCvFiles(
  repository: AiCvAnalyzerRepository,
  storage: CvFileStorage,
  now: Date = new Date()
): Promise<CleanupExpiredCvFilesResult> {
  const expiredFiles = await repository.findExpiredActiveCvFiles(now);
  const deletedFileIds: string[] = [];
  let failed = 0;

  for (const file of expiredFiles) {
    try {
      await storage.deleteFile(file.storageKey);
      deletedFileIds.push(file.id);
    } catch {
      failed += 1;
    }
  }

  const deleted = await repository.markCvFilesDeleted(deletedFileIds, now);

  return {
    processed: expiredFiles.length,
    deleted,
    failed
  };
}

export function buildCvAnalyzerPayload(
  requestId: string,
  input: AnalyzeCvInput,
  metadata: CvFileMetadataRecord,
  job: JobRecord
): CvAnalyzerModelPayload {
  return {
    requestId,
    inputVersion: "cv-analyzer-v1",
    language: toModelLanguage(input.language),
    inputMode: input.inputMode,
    compareSource: input.compareSource,
    cv: {
      fileId: metadata.id,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      storageKey: metadata.storageKey
    },
    job: {
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements.map((requirement) => ({
        type: requirement.type,
        value: requirement.value,
        priority: requirement.priority ?? "LOW"
      })),
      skills: job.skills.map((skill) => skill.name),
      experienceLevel: job.experienceLevel
    }
  };
}

export function mapCvAnalysisResource(
  jobId: string,
  language: "id" | "en",
  response: CvAnalyzerModelResponse
): CvAnalysisResource {
  return {
    jobId,
    language,
    overallImpression: response.overallImpression,
    jobFitAlignment: response.jobFitAlignment,
    atsFriendliness: response.atsFriendliness,
    keywordOptimization: response.keywordOptimization,
    experienceQuantification: response.experienceQuantification,
    actionableImprovements: response.actionableImprovements,
    generatedCv: {
      available: false,
      note: generatedCvUnavailableNote
    },
    model: response.model,
    analyzedAt: response.analyzedAt
  };
}

export function sanitizeOriginalFileName(originalName: string): string {
  const baseName = originalName.split(/[\\/]/).pop() ?? "cv.pdf";
  const sanitized = baseName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);

  return sanitized || "cv.pdf";
}

export function createCvExpiryDate(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export async function cleanupUploadedFile(
  repository: AiCvAnalyzerRepository,
  storage: CvFileStorage,
  fileId: string,
  storageKey: string,
  now: Date
) {
  try {
    await storage.deleteFile(storageKey);
  } finally {
    await repository.markCvFileDeleted(fileId, now);
  }
}

function createValidationError(
  message: string,
  details: { path: string; message: string; code: string }[]
) {
  return new ValidationError(message, details);
}

function toModelLanguage(language: "id" | "en"): "ID" | "EN" {
  return language.toUpperCase() as "ID" | "EN";
}
