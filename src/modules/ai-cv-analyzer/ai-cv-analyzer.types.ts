import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type {
  CvAnalyzerModelPayload,
  CvAnalyzerModelResponse
} from "@/shared/integrations/model-api.schema";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";
import type { SharedCvEvidence } from "@/shared/cv-evidence";
import type { JobRecord } from "@/modules/jobs";

export type UploadedCvFile = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type StoredCvFile = {
  storageDriver: "LOCAL";
  storageKey: string;
};

export type CvFileStorage = {
  saveFile(input: {
    userId: string;
    fileId: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredCvFile>;
  deleteFile(storageKey: string): Promise<void>;
  readFile?(storageKey: string): Promise<Buffer>;
};

export type CvFileMetadataRecord = {
  id: string;
  userId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageDriver: "LOCAL";
  storageKey: string;
  isActive: boolean;
  uploadedAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
};

export type ExpiredCvFileRecord = {
  id: string;
  storageKey: string;
};

export type CvAnalysisResultListQuery = {
  page: number;
  limit: number;
  sortOrder: "asc" | "desc";
  cvFileId?: string;
  schemaVersion?: string;
  inputMode?: "UPLOAD" | "REFERENCE";
  compareSource?: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
};

export type CvAnalysisResultRecord = {
  id: string;
  userId: string;
  cvFileMetadataId: string | null;
  language: "ID" | "EN";
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  schemaVersion: string;
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
};

export type CvAnalysisResultListResult = {
  items: CvAnalysisResultRecord[];
  total: number;
};

export type CvAnalyzerWrapperInput = {
  requestId: string;
  language: "en";
  requestedLanguage: "id" | "en";
  jobRoles: string[];
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  inputMode: "UPLOAD" | "REFERENCE";
  sharedEvidence: SharedCvEvidence;
  modelEvidence: {
    parsedCv: {
      status: CvAnalyzerModelResponse["parsedCv"]["status"];
      pageCount: CvAnalyzerModelResponse["parsedCv"]["pageCount"];
      textLength: CvAnalyzerModelResponse["parsedCv"]["textLength"];
      detectedSections: CvAnalyzerModelResponse["parsedCv"]["detectedSections"];
      extractionEvidence: NonNullable<
        CvAnalyzerModelResponse["parsedCv"]["extractionEvidence"]
      >;
    };
    jobFitAlignment: CvAnalyzerModelResponse["jobFitAlignment"];
    atsFriendliness: CvAnalyzerModelResponse["atsFriendliness"];
    overallImpression: CvAnalyzerModelResponse["overallImpression"];
    candidateReranking: CvAnalyzerModelResponse["candidateReranking"];
    model: CvAnalyzerModelResponse["model"];
    createdAt: CvAnalyzerModelResponse["createdAt"];
  };
  candidateMetadata: {
    jobId: string;
    title: string;
    companyName: string | null;
    locationDisplay: string | null;
  }[];
};

export type CvAnalyzerGenAiClient = {
  generateCvAnalysisCopy(input: CvAnalyzerWrapperInput): Promise<unknown>;
};

export type PublicCvAnalysisResponse = {
  schemaVersion: "cv-analysis-v2";
  jobFitAlignment: { score: number; summary: string };
  atsFriendliness: { score: number; summary: string };
  overallImpression: string;
  topActionables: string[];
  sectionReviews: {
    sectionName: string;
    analysis: string;
    actionPoints: string[];
    whyItsImportantForYou: string;
  }[];
  jobRecommendations: {
    jobId: string;
    title: string;
    companyName: string | null;
    matchScore: number;
    reason: string;
    nextStep: string;
  }[];
  model: CvAnalyzerModelResponse["model"];
  analyzedAt: string;
};

export type CvAnalysisCandidateRecord = JobRecord;

export type CvAnalysisSnapshotInput = {
  userId: string;
  jobRoles: string[];
  cvFileMetadataId: string;
  language: "ID" | "EN";
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  payload: CvAnalyzerModelPayload;
  modelCoreResponse: CvAnalyzerModelResponse;
  response: PublicCvAnalysisResponse;
  candidates: CvAnalysisCandidateRecord[];
  requestId: string;
};

export type AiCvAnalyzerRepository = {
  createCvFileMetadata(input: {
    id: string;
    userId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    storageDriver: "LOCAL";
    storageKey: string;
    expiresAt: Date;
    isActive?: boolean;
  }): Promise<CvFileMetadataRecord>;
  findActiveCvFileMetadata(
    userId: string,
    now: Date
  ): Promise<CvFileMetadataRecord | null>;
  findCvFileMetadataById(
    cvFileId: string,
    now: Date
  ): Promise<CvFileMetadataRecord | null>;
  markCvFileDeleted(fileId: string, deletedAt: Date): Promise<void>;
  findCandidateJobsForCvAnalysis?(input: {
    userId: string;
    compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
    jobRoles: string[];
    directJobId?: string;
    limit: number;
    now: Date;
  }): Promise<CvAnalysisCandidateRecord[]>;
  createSnapshot(input: CvAnalysisSnapshotInput): Promise<string>;
  listAnalysisResults?(
    userId: string,
    query: CvAnalysisResultListQuery
  ): Promise<CvAnalysisResultListResult>;
  findAnalysisResultByIdForUser?(
    userId: string,
    analysisResultId: string
  ): Promise<CvAnalysisResultRecord | null>;
  findLatestAnalysisResultForUser?(
    userId: string
  ): Promise<CvAnalysisResultRecord | null>;
  findExpiredActiveCvFiles(now: Date): Promise<ExpiredCvFileRecord[]>;
  markCvFilesDeleted(fileIds: string[], deletedAt: Date): Promise<number>;
};

export type CvFileResource = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  expiresAt: string;
  isActive: boolean;
};

export type CvAnalysisResource = {
  jobRoles: string[];
  language: "id" | "en";
  analysisResult: {
    id: string;
    schemaVersion: PublicCvAnalysisResponse["schemaVersion"];
    jobFitAlignment: PublicCvAnalysisResponse["jobFitAlignment"];
    atsFriendliness: PublicCvAnalysisResponse["atsFriendliness"];
    overallImpression: PublicCvAnalysisResponse["overallImpression"];
    topActionables: PublicCvAnalysisResponse["topActionables"];
    sectionReviews: PublicCvAnalysisResponse["sectionReviews"];
    jobRecommendations: PublicCvAnalysisResponse["jobRecommendations"];
    generatedCv: {
      available: false;
      note: string;
    };
    model: CvAnalyzerModelResponse["model"];
    analyzedAt: string;
  };
};

export type CvAnalysisResult = {
  resource: CvAnalysisResource;
  persisted: boolean;
  cvFileMetadataId: string;
};

export type AiCvAnalyzerServiceOptions = {
  modelApiClient: ModelApiClient;
  storage: CvFileStorage;
  cvRetentionDays: number;
  now?: () => Date;
  genAiEnabled?: boolean;
  genAiClient?: CvAnalyzerGenAiClient;
};

export type CleanupExpiredCvFilesResult = {
  processed: number;
  deleted: number;
  failed: number;
};

export type AiCvAnalyzerControllerDependencies = {
  repository: AiCvAnalyzerRepository;
  config: AppConfig;
  modelApiClient: ModelApiClient;
  genAiClient?: CvAnalyzerGenAiClient;
  storage: CvFileStorage;
  now?: () => Date;
};

export type AiCvAnalyzerRouterOptions = {
  repository?: AiCvAnalyzerRepository;
  authMiddleware?: RequestHandler;
  modelApiClient?: ModelApiClient;
  genAiClient?: CvAnalyzerGenAiClient;
  storage?: CvFileStorage;
  now?: () => Date;
};
