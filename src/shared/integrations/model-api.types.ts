import type { AppConfig } from "@/config/env";
import type {
  CvAnalyzerModelPayload,
  CvAnalyzerModelResponse,
  JobFitModelPayload,
  JobFitModelResponse
} from "@/shared/integrations/model-api.schema";

export type ModelApiFetch = typeof fetch;

export type ModelApiMockResponses = {
  cvAnalyzer?: CvAnalyzerModelResponse;
  jobFit?: JobFitModelResponse;
};

export type ModelApiClientOptions = {
  fetch?: ModelApiFetch;
  now?: () => number;
  jobFitPath?: string;
  cvAnalyzerPath?: string;
  mockResponses?: ModelApiMockResponses;
};

export type ModelApiClientDependencies = {
  config: AppConfig;
} & ModelApiClientOptions;

export type ModelApiClient = {
  analyzeJobFit(payload: JobFitModelPayload): Promise<JobFitModelResponse>;
  analyzeCv(payload: CvAnalyzerModelPayload): Promise<CvAnalyzerModelResponse>;
};
