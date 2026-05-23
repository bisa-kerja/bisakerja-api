import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type { JobRecord } from "@/modules/jobs";
import type { PreferenceContext } from "@/modules/preferences";
import type {
  GenerateJobRecommendationsInput,
  GetJobRecommendationsQueryInput
} from "@/modules/ai-job-recommendations/ai-job-recommendations.schema";
import type {
  JobRecommendationModelPayload,
  JobRecommendationModelResponse
} from "@/shared/integrations/model-api.schema";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";

export type CvAnalysisResolverRecord = {
  id: string;
  userId: string;
  jobListingId: string;
  schemaVersion: string;
  analyzedAt: Date;
  job: JobRecord;
  jobFitAlignment: {
    score: number;
    summary: string;
    matchedSignals: string[];
    missingSignals: string[];
  };
  topActionables: string[];
  sectionReviews: {
    sectionName: string;
    analysis: string;
    actionPoints: string[];
    whyItsImportantForYou: string;
  }[];
};

export type RecommendationCandidateRecord = {
  job: JobRecord;
  isBookmarked: boolean;
  hasApplied: boolean;
};

export type JobRecommendationRunSnapshotItemInput = {
  jobListingId: string;
  rank: number;
  matchScore: number;
  matchLevel: "STRONG" | "GOOD" | "STRETCH";
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
  nextSteps: string[];
};

export type JobRecommendationRunSnapshotInput = {
  userId: string;
  cvAnalysisResultId: string;
  idempotencyKey: string | null;
  requestedLimit: number;
  candidateCount: number;
  recommendationCount: number;
  modelName: string;
  modelVersion: string;
  filtersSnapshot: GenerateJobRecommendationsInput["filters"] | null;
  inputSummary: JobRecommendationModelPayload;
  createdAt: Date;
  items: JobRecommendationRunSnapshotItemInput[];
};

export type JobRecommendationRunRecord = {
  id: string;
  cvAnalysisResultId: string;
  generatedAt: string;
  modelName: string;
  modelVersion: string;
  candidateCount: number;
  recommendationCount: number;
};

export type JobRecommendationItemResource = {
  job: {
    id: string;
    title: string;
    companyName: string;
    location: string | null;
    workType: JobRecord["workType"];
    experienceLevel: JobRecord["experienceLevel"];
  };
  matchScore: number;
  matchLevel: "strong" | "good" | "stretch";
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
  nextSteps: string[];
  isBookmarked: boolean;
  hasApplied: boolean;
};

export type JobRecommendationResource = {
  recommendationRun: JobRecommendationRunRecord;
  recommendations: JobRecommendationItemResource[];
};

export type JobRecommendationRunDetailRecord = {
  id: string;
  cvAnalysisResultId: string;
  createdAt: Date;
  modelName: string;
  modelVersion: string;
  candidateCount: number;
  recommendationCount: number;
  items: {
    rank: number;
    matchScore: number;
    matchLevel: "STRONG" | "GOOD" | "STRETCH";
    reasons: string[];
    matchedSkills: string[];
    missingSkills: string[];
    nextSteps: string[];
    job: JobRecord;
    isBookmarked: boolean;
    hasApplied: boolean;
  }[];
};

export type JobRecommendationRequestContext = {
  userId: string;
  cvAnalysisResult: CvAnalysisResolverRecord;
  preference: PreferenceContext | null;
  candidates: RecommendationCandidateRecord[];
};

export type AiJobRecommendationsRepository = {
  findCvAnalysisResultByIdForUser(
    userId: string,
    cvAnalysisResultId: string
  ): Promise<CvAnalysisResolverRecord | null>;
  findLatestCvAnalysisResultForUser(
    userId: string
  ): Promise<CvAnalysisResolverRecord | null>;
  findUserPreference(userId: string): Promise<PreferenceContext | null>;
  findRecommendationRunByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<JobRecommendationRunDetailRecord | null>;
  findLatestRecommendationRunForUser(
    userId: string
  ): Promise<JobRecommendationRunDetailRecord | null>;
  findRecommendationRunByIdForUser(
    userId: string,
    recommendationRunId: string
  ): Promise<JobRecommendationRunDetailRecord | null>;
  findCandidateJobsForRecommendations(input: {
    userId: string;
    cvAnalysisResult: CvAnalysisResolverRecord;
    filters: GenerateJobRecommendationsInput["filters"];
    limit: number;
  }): Promise<RecommendationCandidateRecord[]>;
  createRecommendationRunSnapshot(
    input: JobRecommendationRunSnapshotInput
  ): Promise<JobRecommendationRunDetailRecord>;
};

export type AiJobRecommendationsServiceOptions = {
  modelApiClient: ModelApiClient;
  now?: () => Date;
};

export type AiJobRecommendationsControllerDependencies = {
  repository: AiJobRecommendationsRepository;
  config: AppConfig;
  modelApiClient: ModelApiClient;
  now?: () => Date;
};

export type AiJobRecommendationsRouterOptions = {
  repository?: AiJobRecommendationsRepository;
  authMiddleware?: RequestHandler;
  modelApiClient?: ModelApiClient;
  now?: () => Date;
};

export type BuildTalentProfileInput = {
  cvAnalysisResult: CvAnalysisResolverRecord;
  preference: PreferenceContext | null;
};

export type TalentProfileResource =
  JobRecommendationModelPayload["talentProfile"];

export type BuildJobCandidatePayloadInput = {
  candidates: RecommendationCandidateRecord[];
};

export type CandidatePayloadItem =
  JobRecommendationModelPayload["jobCandidates"][number];

export type BuildRecommendationPayloadInput = {
  requestId: string;
  context: JobRecommendationRequestContext;
  limit: number;
};

export type JobRecommendationQueryInput = GetJobRecommendationsQueryInput;

export type JobRecommendationModelOutput =
  JobRecommendationModelResponse["recommendations"][number];
