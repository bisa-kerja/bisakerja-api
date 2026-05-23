import type { AppConfig } from "@/config/env";
import type {
  CvAnalyzerModelPayload,
  CvAnalyzerModelResponse,
  CvGenerateModelPayload,
  CvGenerateModelResponse,
  JobRecommendationModelPayload,
  JobRecommendationModelResponse,
  JobFitModelPayload,
  JobFitModelResponse
} from "@/shared/integrations/model-api.schema";

export type ModelApiFetch = typeof fetch;

export type ModelApiMockResponses = {
  cvAnalyzer?: CvAnalyzerModelResponse;
  cvGenerate?: CvGenerateModelResponse;
  jobFit?: JobFitModelResponse;
  jobRecommendations?: JobRecommendationModelResponse;
};

export type ModelApiClientOptions = {
  fetch?: ModelApiFetch;
  now?: () => number;
  jobFitPath?: string;
  cvAnalyzerPath?: string;
  cvGeneratePath?: string;
  jobRecommendationsPath?: string;
  mockResponses?: ModelApiMockResponses;
};

export type ModelApiClientDependencies = {
  config: AppConfig;
} & ModelApiClientOptions;

export type ModelApiClient = {
  analyzeJobFit(payload: JobFitModelPayload): Promise<JobFitModelResponse>;
  analyzeCv(payload: CvAnalyzerModelPayload): Promise<CvAnalyzerModelResponse>;
  generateCvMarkdown?(
    payload: CvGenerateModelPayload
  ): Promise<CvGenerateModelResponse>;
  recommendJobs?(
    payload: JobRecommendationModelPayload
  ): Promise<JobRecommendationModelResponse>;
};
