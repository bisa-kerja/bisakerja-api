import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type { JobRecord } from "@/modules/jobs";
import type {
  PreferenceContext,
  PreferenceSalaryExpectation,
  PreferenceWorkType
} from "@/modules/preferences";
import type {
  CurrentUserExperience,
  CurrentUserProfileRecord,
  CurrentUserSkill
} from "@/modules/users";
import type {
  JobFitModelPayload,
  JobFitModelResponse
} from "@/shared/integrations/model-api.schema";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";

export type AiJobFitUserContext = {
  userId: string;
  profile: CurrentUserProfileRecord | null;
  skills: CurrentUserSkill[];
  experience: CurrentUserExperience[];
  preference: PreferenceContext | null;
};

export type JobFitAnalysisSnapshotInput = {
  userId: string;
  jobId: string;
  payload: JobFitModelPayload;
  response: JobFitModelResponse;
};

export type AiJobFitRepository = {
  findUserContext(userId: string): Promise<AiJobFitUserContext | null>;
  findVisibleJob(jobId: string): Promise<JobRecord | null>;
  createSnapshot(input: JobFitAnalysisSnapshotInput): Promise<void>;
};

export type JobFitRecommendationResource = {
  decision: JobFitModelResponse["recommendation"]["decision"];
  summary: string;
  nextSteps: string[];
  successProbability: number | null;
};

export type JobFitBreakdownResource = {
  skillMatch: JobFitModelResponse["breakdown"]["skillMatch"];
  experienceMatch: JobFitModelResponse["breakdown"]["experienceMatch"];
  preferenceMatch: JobFitModelResponse["breakdown"]["preferenceMatch"];
};

export type JobFitResource = {
  jobId: string;
  fitScore: number;
  readinessLevel: JobFitModelResponse["readinessLevel"];
  recommendation: JobFitRecommendationResource;
  breakdown: JobFitBreakdownResource;
  skillGaps: JobFitModelResponse["skillGaps"];
  model: JobFitModelResponse["model"];
  analyzedAt: string;
};

export type JobFitAnalysisResult = {
  resource: JobFitResource;
  persisted: boolean;
};

export type AiJobFitServiceOptions = {
  modelApiClient: ModelApiClient;
};

export type AiJobFitControllerDependencies = {
  repository: AiJobFitRepository;
  config: AppConfig;
  modelApiClient: ModelApiClient;
  now?: () => Date;
};

export type AiJobFitRouterOptions = {
  repository?: AiJobFitRepository;
  authMiddleware?: RequestHandler;
  modelApiClient?: ModelApiClient;
  now?: () => Date;
};

export type JobFitPayloadUser = {
  careerStatus: CurrentUserProfileRecord["careerStatus"];
  skills: {
    name: string;
    level: CurrentUserSkill["level"];
  }[];
  experience: {
    title: string;
    company: string | null;
    employmentType: CurrentUserExperience["employmentType"];
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
  }[];
};

export type JobFitPayloadPreferences = {
  targetRoles: string[];
  locations: PreferenceContext["locations"];
  workTypes: PreferenceWorkType[];
  salaryExpectation: PreferenceSalaryExpectation | null;
};
