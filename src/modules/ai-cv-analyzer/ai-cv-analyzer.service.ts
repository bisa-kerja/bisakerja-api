import { NotFoundError, ValidationError } from "@/core/errors/app.error";
import {
  aiCvAnalyzerErrorCodes,
  generatedCvUnavailableNote
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.constants";
import type {
  AnalyzeCvInput,
  ListCvAnalysisResultsQueryInput,
  UploadCvFileInput
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.schema";
import type {
  AiCvAnalyzerRepository,
  AiCvAnalyzerServiceOptions,
  CleanupExpiredCvFilesResult,
  CvAnalysisResource,
  CvAnalysisResult,
  CvFileResource,
  CvFileMetadataRecord,
  CvFileStorage,
  UploadedCvFile
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";
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
    let cleanupTarget: { fileId: string; storageKey: string } | null = null;

    try {
      const cvSource = await this.resolveCvSource(userId, input, uploadedFile);
      cleanupTarget = cvSource.cleanupTarget;

      const payload = buildCvAnalyzerPayload(
        requestId,
        cvSource.input,
        cvSource.metadata
      );
      const response = await this.options.modelApiClient.analyzeCv(payload);
      const persisted = input.persistResult;

      if (persisted) {
        await this.repository.createSnapshot({
          userId,
          jobRoles: cvSource.input.jobRoles,
          cvFileMetadataId: cvSource.metadata.id,
          language: toModelLanguage(cvSource.input.language),
          inputMode: cvSource.input.inputMode,
          compareSource: input.compareSource,
          payload,
          response
        });
      }

      return {
        resource: mapCvAnalysisResource(
          crypto.randomUUID(),
          cvSource.input.jobRoles,
          cvSource.input.language,
          response
        ),
        persisted,
        cvFileMetadataId: cvSource.metadata.id
      };
    } catch (error) {
      if (cleanupTarget) {
        await cleanupUploadedFile(
          this.repository,
          this.options.storage,
          cleanupTarget.fileId,
          cleanupTarget.storageKey,
          this.now()
        );
      }
      throw error;
    }
  }

  async uploadCvFile(
    userId: string,
    input: UploadCvFileInput,
    uploadedFile: UploadedCvFile | null
  ): Promise<CvFileResource> {
    if (!uploadedFile) {
      throw createValidationError("File CV wajib diunggah", [
        {
          path: "cvFile",
          message: "File CV wajib diunggah",
          code: "custom"
        }
      ]);
    }

    const fileId = crypto.randomUUID();
    const storedFile = await this.options.storage.saveFile({
      userId,
      fileId,
      mimeType: uploadedFile.mimeType,
      buffer: uploadedFile.buffer
    });

    try {
      const metadata = await this.repository.createCvFileMetadata({
        id: fileId,
        userId,
        originalFileName: sanitizeOriginalFileName(uploadedFile.originalName),
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.sizeBytes,
        storageDriver: storedFile.storageDriver,
        storageKey: storedFile.storageKey,
        expiresAt: createCvExpiryDate(this.now(), this.options.cvRetentionDays),
        isActive: input.setAsActive
      });

      return mapCvFileResource(metadata);
    } catch (error) {
      await cleanupUploadedFile(
        this.repository,
        this.options.storage,
        fileId,
        storedFile.storageKey,
        this.now()
      );
      throw error;
    }
  }

  async listAnalysisResults(
    userId: string,
    query: ListCvAnalysisResultsQueryInput
  ) {
    if (!this.repository.listAnalysisResults) {
      throw new Error("CV analysis result listing is not supported");
    }

    const result = await this.repository.listAnalysisResults(userId, query);
    const totalPages = Math.ceil(result.total / query.limit);

    return {
      data: result.items.map(mapCvAnalysisResultSummary),
      meta: {
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPrevPage: query.page > 1
        },
        filters: {
          cvFileId: query.cvFileId,
          schemaVersion: query.schemaVersion,
          inputMode: query.inputMode,
          compareSource: query.compareSource
        },
        sort: `${query.sortBy}:${query.sortOrder}`
      }
    };
  }

  async getAnalysisResultDetail(userId: string, analysisResultId: string) {
    if (!this.repository.findAnalysisResultByIdForUser) {
      throw new Error("CV analysis result detail is not supported");
    }

    const record = await this.repository.findAnalysisResultByIdForUser(
      userId,
      analysisResultId
    );

    if (!record) {
      throw new NotFoundError(
        "Hasil analisis CV tidak ditemukan",
        aiCvAnalyzerErrorCodes.cvAnalysisResultNotFound
      );
    }

    return mapCvAnalysisResultDetail(record);
  }

  async getLatestAnalysisResult(userId: string) {
    if (!this.repository.findLatestAnalysisResultForUser) {
      throw new Error("CV analysis result latest is not supported");
    }

    const record =
      await this.repository.findLatestAnalysisResultForUser(userId);

    if (!record) {
      throw new NotFoundError(
        "Hasil analisis CV tidak ditemukan",
        aiCvAnalyzerErrorCodes.cvAnalysisResultNotFound
      );
    }

    return mapCvAnalysisResultDetail(record);
  }

  async getActiveCvFile(userId: string): Promise<CvFileResource> {
    const metadata = await this.repository.findActiveCvFileMetadata(
      userId,
      this.now()
    );

    if (!metadata) {
      throw new NotFoundError(
        "CV aktif tidak ditemukan",
        aiCvAnalyzerErrorCodes.cvFileNotFound
      );
    }

    return mapCvFileResource(metadata);
  }

  private async resolveCvSource(
    userId: string,
    input: AnalyzeCvInput,
    uploadedFile: UploadedCvFile | null
  ): Promise<{
    input: AnalyzeCvInput;
    metadata: CvFileMetadataRecord;
    cleanupTarget: { fileId: string; storageKey: string } | null;
  }> {
    if (uploadedFile) {
      const fileId = crypto.randomUUID();
      const storedFile = await this.options.storage.saveFile({
        userId,
        fileId,
        mimeType: uploadedFile.mimeType,
        buffer: uploadedFile.buffer
      });
      const metadata = await this.repository.createCvFileMetadata({
        id: fileId,
        userId,
        originalFileName: sanitizeOriginalFileName(uploadedFile.originalName),
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.sizeBytes,
        storageDriver: storedFile.storageDriver,
        storageKey: storedFile.storageKey,
        expiresAt: createCvExpiryDate(this.now(), this.options.cvRetentionDays),
        isActive: false
      });

      return {
        input: {
          ...input,
          inputMode: "UPLOAD",
          cvFileId: undefined
        },
        metadata,
        cleanupTarget: {
          fileId,
          storageKey: storedFile.storageKey
        }
      };
    }

    if (input.cvFileId) {
      const metadata = await this.repository.findCvFileMetadataById(
        input.cvFileId,
        this.now()
      );

      if (!metadata) {
        throw new NotFoundError(
          "CV tidak ditemukan",
          aiCvAnalyzerErrorCodes.cvFileNotFound
        );
      }

      if (metadata.userId !== userId) {
        throw new NotFoundError(
          "CV tidak ditemukan",
          aiCvAnalyzerErrorCodes.cvFileNotFound
        );
      }

      return {
        input: {
          ...input,
          inputMode: "REFERENCE"
        },
        metadata,
        cleanupTarget: null
      };
    }

    if (input.inputMode === "REFERENCE") {
      const metadata = await this.repository.findActiveCvFileMetadata(
        userId,
        this.now()
      );

      if (!metadata) {
        throw createValidationError("CV aktif belum tersedia", [
          {
            path: "cvFileId",
            message: "Unggah CV atau kirim ID file CV yang valid",
            code: "custom"
          }
        ]);
      }

      return {
        input: {
          ...input,
          inputMode: "REFERENCE"
        },
        metadata,
        cleanupTarget: null
      };
    }

    throw createValidationError("File CV wajib diunggah", [
      {
        path: "cvFile",
        message: "File CV PDF diperlukan untuk analisis",
        code: "custom"
      }
    ]);
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
  metadata: CvFileMetadataRecord
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
    jobRoles: input.jobRoles
  };
}

export function mapCvAnalysisResource(
  analysisId: string,
  jobRoles: string[],
  language: "id" | "en",
  response: CvAnalyzerModelResponse
): CvAnalysisResource {
  return {
    jobRoles,
    language,
    analysisResult: {
      id: analysisId,
      schemaVersion: response.schemaVersion,
      jobFitAlignment: response.jobFitAlignment,
      atsFriendliness: response.atsFriendliness,
      overallImpression: response.overallImpression,
      topActionables: response.topActionables,
      sectionReviews: response.sectionReviews,
      jobRecommendations: response.jobRecommendations,
      generatedCv: {
        available: false,
        note: generatedCvUnavailableNote
      },
      model: response.model,
      analyzedAt: response.analyzedAt
    }
  };
}

export function mapCvFileResource(
  metadata: CvFileMetadataRecord
): CvFileResource {
  return {
    id: metadata.id,
    originalFileName: metadata.originalFileName,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
    uploadedAt: metadata.uploadedAt.toISOString(),
    expiresAt: metadata.expiresAt.toISOString(),
    isActive: metadata.isActive
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

function mapCvAnalysisResultSummary(record: {
  id: string;
  schemaVersion: string;
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  analyzedAt: Date;
  overallImpression: string;
  jobFitAlignment: unknown;
  atsFriendliness: unknown;
  topActionables: unknown;
  modelName: string | null;
  modelVersion: string | null;
  cvFileMetadata: CvFileMetadataRecord | null;
}) {
  return {
    id: record.id,
    schemaVersion: record.schemaVersion,
    analyzedAt: record.analyzedAt.toISOString(),
    inputMode: record.inputMode,
    compareSource: record.compareSource,
    jobFitAlignment: { score: getScore(record.jobFitAlignment) },
    atsFriendliness: { score: getScore(record.atsFriendliness) },
    overallImpressionPreview: record.overallImpression,
    topActionablesPreview: Array.isArray(record.topActionables)
      ? record.topActionables.slice(0, 3)
      : [],
    model: {
      name: record.modelName,
      version: record.modelVersion
    },
    cvFile: mapSafeCvFile(record.cvFileMetadata)
  };
}

function mapCvAnalysisResultDetail(record: {
  id: string;
  schemaVersion: string;
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  language: "ID" | "EN";
  overallImpression: string;
  jobFitAlignment: unknown;
  atsFriendliness: unknown;
  topActionables: unknown;
  sectionReviews: unknown;
  jobRecommendations: unknown;
  modelName: string | null;
  modelVersion: string | null;
  inputSummary: unknown;
  analyzedAt: Date;
  cvFileMetadata: CvFileMetadataRecord | null;
}) {
  return {
    analysisResult: {
      id: record.id,
      schemaVersion: record.schemaVersion,
      jobFitAlignment: record.jobFitAlignment,
      atsFriendliness: record.atsFriendliness,
      overallImpression: record.overallImpression,
      topActionables: record.topActionables,
      sectionReviews: record.sectionReviews,
      jobRecommendations: record.jobRecommendations,
      generatedCv: {
        available: false,
        note: generatedCvUnavailableNote
      },
      model: {
        name: record.modelName,
        version: record.modelVersion
      },
      analyzedAt: record.analyzedAt.toISOString()
    },
    context: {
      language: record.language === "ID" ? "id" : "en",
      inputMode: record.inputMode,
      compareSource: record.compareSource,
      cvFile: mapSafeCvFile(record.cvFileMetadata),
      inputSummary: sanitizeInputSummary(record.inputSummary)
    }
  };
}

function mapSafeCvFile(metadata: CvFileMetadataRecord | null) {
  if (!metadata || metadata.deletedAt || metadata.expiresAt <= new Date()) {
    return null;
  }

  return {
    id: metadata.id,
    originalFileName: metadata.originalFileName,
    uploadedAt: metadata.uploadedAt.toISOString()
  };
}

function getScore(value: unknown) {
  if (value && typeof value === "object" && "score" in value) {
    const score = (value as { score?: unknown }).score;
    return typeof score === "number" ? score : null;
  }

  return null;
}

function sanitizeInputSummary(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const summary = value as { jobRoles?: unknown; file?: unknown };
  return {
    jobRoles: Array.isArray(summary.jobRoles) ? summary.jobRoles : [],
    file: summary.file ?? null
  };
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
