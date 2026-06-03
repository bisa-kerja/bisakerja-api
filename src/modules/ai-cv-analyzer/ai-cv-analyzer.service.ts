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
  CvAnalysisCandidateRecord,
  CvAnalysisResult,
  CvFileResource,
  CvFileMetadataRecord,
  CvFileStorage,
  PublicCvAnalysisResponse,
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

      const candidates = this.repository.findCandidateJobsForCvAnalysis
        ? await this.repository.findCandidateJobsForCvAnalysis({
            userId,
            compareSource: input.compareSource,
            jobRoles: cvSource.input.jobRoles,
            directJobId: cvSource.input.directJobId,
            limit: 50,
            now: this.now()
          })
        : [];
      const cvBytes = await resolveCvBytes(
        this.options.storage,
        cvSource.metadata.storageKey,
        uploadedFile
      );
      const payload = buildCvAnalyzerPayload(
        requestId,
        cvSource.input,
        cvSource.metadata,
        candidates,
        cvBytes
      );
      const modelCoreResponse =
        await this.options.modelApiClient.analyzeCv(payload);
      const response = buildPublicCvAnalysisResponse(
        modelCoreResponse,
        candidates,
        cvSource.input.language
      );
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
          modelCoreResponse,
          response,
          candidates,
          requestId
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
      throw createValidationError("CV file is required", [
        {
          path: "cvFile",
          message: "CV file is required",
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
        "CV analysis result not found",
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
        "CV analysis result not found",
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
        "Active CV not found",
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
          "CV not found",
          aiCvAnalyzerErrorCodes.cvFileNotFound
        );
      }

      if (metadata.userId !== userId) {
        throw new NotFoundError(
          "CV not found",
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
        throw createValidationError("Active CV is not available yet", [
          {
            path: "cvFileId",
            message: "Upload a CV or send a valid CV file ID",
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

    throw createValidationError("CV file is required", [
      {
        path: "cvFile",
        message: "PDF CV file is required for analysis",
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
  metadata: CvFileMetadataRecord,
  candidates: CvAnalysisCandidateRecord[] = [],
  cvBytes?: Buffer
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
      storageKey: metadata.storageKey,
      bytes: cvBytes
    },
    jobRoles: input.jobRoles,
    rankingPolicy: {
      backendOwnsHydration: true,
      requireCandidateJobIds: true,
      deduplicateByJobId: true,
      maxRecommendations: Math.min(5, candidates.length)
    },
    jobCandidates: candidates.map(mapJobCandidateForModel)
  };
}

export function buildPublicCvAnalysisResponse(
  response: CvAnalyzerModelResponse,
  candidates: CvAnalysisCandidateRecord[],
  language: "id" | "en"
): PublicCvAnalysisResponse {
  const candidateById = new Map(candidates.map((job) => [job.id, job]));
  const seenJobIds = new Set<string>();
  for (const recommendation of response.candidateReranking.recommendations) {
    if (!candidateById.has(recommendation.jobId)) {
      throw new Error(
        "Model API returned recommendation outside backend candidates"
      );
    }
    if (seenJobIds.has(recommendation.jobId)) {
      throw new Error("Model API returned duplicate recommendation job id");
    }
    seenJobIds.add(recommendation.jobId);
  }

  const recommendations = response.candidateReranking.recommendations
    .slice(0, 5)
    .map((recommendation) => {
      const job = candidateById.get(recommendation.jobId);
      if (!job) {
        throw new Error("Validated recommendation missing candidate job");
      }
      return {
        jobId: job.id,
        title: job.title,
        companyName: job.company.name,
        matchScore: recommendation.matchScore,
        reason: buildRecommendationReason(
          recommendation.matchedSkills,
          language
        ),
        nextStep: buildRecommendationNextStep(
          recommendation.missingSkills,
          language
        )
      };
    });

  return {
    schemaVersion: "cv-analysis-v2",
    jobFitAlignment: {
      score: response.jobFitAlignment.score,
      summary: buildJobFitSummary(response, language)
    },
    atsFriendliness: {
      score: response.atsFriendliness.score,
      summary: buildAtsSummary(response, language)
    },
    overallImpression: buildOverallImpression(response, language),
    topActionables: buildTopActionables(response, language),
    sectionReviews: buildSectionReviews(response, language),
    jobRecommendations: recommendations,
    model: response.model,
    analyzedAt: response.createdAt
  };
}

export function mapCvAnalysisResource(
  analysisId: string,
  jobRoles: string[],
  language: "id" | "en",
  response: PublicCvAnalysisResponse
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

async function resolveCvBytes(
  storage: CvFileStorage,
  storageKey: string,
  uploadedFile: UploadedCvFile | null
): Promise<Buffer> {
  if (uploadedFile) {
    return uploadedFile.buffer;
  }

  if (!storage.readFile) {
    throw createValidationError("Reference CV file cannot be read", [
      {
        path: "cvFileId",
        message: "CV storage does not support reading reference files",
        code: "custom"
      }
    ]);
  }

  return storage.readFile(storageKey);
}

function mapJobCandidateForModel(job: CvAnalysisCandidateRecord) {
  return {
    jobId: job.id,
    scoringInput: {
      titleText: job.title,
      descriptionText: job.description,
      requirementSummary: job.requirementSummary,
      requiredSkills: job.skills.map((skill) => skill.name),
      requirements: job.requirements.map((requirement) => ({
        type: requirement.type,
        value: requirement.value,
        priority: requirement.priority ?? "MEDIUM"
      })),
      roleFamily: job.normalizedTitle ?? job.category,
      experienceLevel: job.experienceLevel,
      workType: job.workType
    },
    backendMetadata: {
      title: job.title,
      companyName: job.company.name,
      locationDisplay: job.location.display,
      sourceUpdatedAt: job.sourceUpdatedAt?.toISOString() ?? null
    }
  };
}

function buildJobFitSummary(
  response: CvAnalyzerModelResponse,
  language: "id" | "en"
) {
  const matched = response.jobFitAlignment.matchedSkills.slice(0, 3).join(", ");
  const missing = response.jobFitAlignment.missingSkills.slice(0, 3).join(", ");

  if (language === "en") {
    return matched
      ? `CV shows fit through ${matched}${missing ? `, with gaps in ${missing}` : ""}.`
      : "CV fit is based on available parsed evidence.";
  }

  return matched
    ? `CV shows fit through ${matched}${missing ? `, with gaps in ${missing}` : ""}.`
    : "CV fit is based on available parsed evidence.";
}

function buildAtsSummary(
  response: CvAnalyzerModelResponse,
  language: "id" | "en"
) {
  const issues = response.atsFriendliness.detectedIssues.slice(0, 3).join(", ");
  if (language === "en") {
    return issues
      ? `ATS review found ${issues}.`
      : "CV structure is readable based on parser evidence.";
  }
  return issues
    ? `ATS review found ${issues}.`
    : "CV structure is readable based on parser evidence.";
}

function buildOverallImpression(
  response: CvAnalyzerModelResponse,
  language: "id" | "en"
) {
  const evidence = response.overallImpression.evidence.slice(0, 2).join(", ");
  if (language === "en") {
    return evidence
      ? `Overall impression is grounded in ${evidence}.`
      : "Overall impression is grounded in model evidence.";
  }
  return evidence
    ? `Overall impression is grounded in ${evidence}.`
    : "Overall impression is grounded in model evidence.";
}

function buildTopActionables(
  response: CvAnalyzerModelResponse,
  language: "id" | "en"
) {
  const missing = response.jobFitAlignment.missingSkills.slice(0, 2);
  const ats = response.atsFriendliness.detectedIssues.slice(0, 1);
  const fallback =
    language === "en"
      ? "Keep CV claims specific and evidence-based."
      : "Keep CV claims specific and evidence-based.";

  return [
    ...missing.map((skill) =>
      language === "en"
        ? `Add stronger evidence for ${skill}.`
        : `Add stronger evidence for ${skill}.`
    ),
    ...ats.map((issue) =>
      language === "en"
        ? `Fix ATS issue: ${issue}.`
        : `Fix ATS issue: ${issue}.`
    ),
    fallback
  ].slice(0, 3);
}

function buildSectionReviews(
  response: CvAnalyzerModelResponse,
  language: "id" | "en"
): PublicCvAnalysisResponse["sectionReviews"] {
  return [
    {
      sectionName: language === "en" ? "Skills" : "Skills",
      analysis: buildJobFitSummary(response, language),
      actionPoints: buildTopActionables(response, language).slice(0, 2),
      whyItsImportantForYou:
        language === "en"
          ? "Recruiters compare visible skills with job requirements."
          : "Recruiter compares visible skills with job requirements."
    },
    {
      sectionName: "ATS",
      analysis: buildAtsSummary(response, language),
      actionPoints: response.atsFriendliness.detectedIssues.length
        ? response.atsFriendliness.detectedIssues.slice(0, 2)
        : [
            language === "en"
              ? "Keep sections clear and searchable."
              : "Keep sections clear and searchable."
          ],
      whyItsImportantForYou:
        language === "en"
          ? "Readable CV text improves automated screening."
          : "Readable CV text improves automated screening."
    }
  ];
}

function buildRecommendationReason(skills: string[], language: "id" | "en") {
  const matched = skills.slice(0, 3).join(", ");
  if (language === "en") {
    return matched
      ? `Matched skills: ${matched}.`
      : "Recommended from model ranking evidence.";
  }
  return matched
    ? `Matched skills: ${matched}.`
    : "Recommended from model ranking evidence.";
}

function buildRecommendationNextStep(skills: string[], language: "id" | "en") {
  const missing = skills.slice(0, 2).join(", ");
  if (language === "en") {
    return missing
      ? `Prepare evidence for ${missing}.`
      : "Review job details before applying.";
  }
  return missing
    ? `Prepare evidence for ${missing}.`
    : "Review job details before applying.";
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
