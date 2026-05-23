import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type {
  CvAnalyzerModelPayload,
  CvAnalyzerModelResponse
} from "@/shared/integrations/model-api.schema";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";

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

export type CvAnalysisSnapshotInput = {
  userId: string;
  jobRoles: string[];
  cvFileMetadataId: string;
  language: "ID" | "EN";
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  payload: CvAnalyzerModelPayload;
  response: CvAnalyzerModelResponse;
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
  createSnapshot(input: CvAnalysisSnapshotInput): Promise<void>;
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
    schemaVersion: CvAnalyzerModelResponse["schemaVersion"];
    jobFitAlignment: CvAnalyzerModelResponse["jobFitAlignment"];
    atsFriendliness: CvAnalyzerModelResponse["atsFriendliness"];
    overallImpression: CvAnalyzerModelResponse["overallImpression"];
    topActionables: CvAnalyzerModelResponse["topActionables"];
    sectionReviews: CvAnalyzerModelResponse["sectionReviews"];
    jobRecommendations: CvAnalyzerModelResponse["jobRecommendations"];
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
  storage: CvFileStorage;
  now?: () => Date;
};

export type AiCvAnalyzerRouterOptions = {
  repository?: AiCvAnalyzerRepository;
  authMiddleware?: RequestHandler;
  modelApiClient?: ModelApiClient;
  storage?: CvFileStorage;
  now?: () => Date;
};
