import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type { AiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";

export type CvMarkdownResource = {
  markdown: string;
};

export type AiCvGenerateServiceOptions = {
  modelApiClient: ModelApiClient;
  now?: () => Date;
};

export type AiCvGenerateControllerDependencies = {
  repository: AiCvAnalyzerRepository;
  config: AppConfig;
  modelApiClient: ModelApiClient;
  now?: () => Date;
};

export type AiCvGenerateRouterOptions = {
  repository?: AiCvAnalyzerRepository;
  authMiddleware?: RequestHandler;
  modelApiClient?: ModelApiClient;
  now?: () => Date;
};
