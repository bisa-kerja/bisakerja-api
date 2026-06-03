import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type {
  AiCvAnalyzerRepository,
  CvFileStorage,
  PublicCvAnalysisResponse
} from "@/modules/ai-cv-analyzer";

export type CvMarkdownResource = {
  markdown: string;
};

export type AiCvGenerateEvidence = {
  cvFile: {
    fileId: string;
    mimeType: string;
    sizeBytes: number;
  };
  cvTextPreview: string;
  latestAnalysis: Pick<
    PublicCvAnalysisResponse,
    | "jobFitAlignment"
    | "atsFriendliness"
    | "overallImpression"
    | "topActionables"
    | "sectionReviews"
  > | null;
};

export type AiCvGenerateGenAiInput = {
  requestId: string;
  inputVersion: "cv-generate-v1";
  summary: string;
  templateHtml: string;
  evidence: AiCvGenerateEvidence;
};

export type AiCvGenerateGenAiClient = {
  generateMarkdown(input: AiCvGenerateGenAiInput): Promise<string>;
};

export type AiCvGenerateServiceOptions = {
  storage: CvFileStorage;
  genAiClient?: AiCvGenerateGenAiClient;
  genAiEnabled?: boolean;
  now?: () => Date;
};

export type AiCvGenerateControllerDependencies = {
  repository: AiCvAnalyzerRepository;
  config: AppConfig;
  storage: CvFileStorage;
  genAiClient?: AiCvGenerateGenAiClient;
  now?: () => Date;
};

export type AiCvGenerateRouterOptions = {
  repository?: AiCvAnalyzerRepository;
  authMiddleware?: RequestHandler;
  storage?: CvFileStorage;
  genAiClient?: AiCvGenerateGenAiClient;
  now?: () => Date;
};
