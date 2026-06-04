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

export type AiCvGenerateStructuredEvidence = {
  source: "backend_parser" | "latest_analysis_cache" | "metadata_only";
  candidateSummary: string | null;
  sectionSummaries: {
    sectionName: string;
    summary: string;
    confidence: "high" | "medium" | "low";
  }[];
  experienceBullets: string[];
  projectBullets: string[];
  skillsByCategory: {
    category: string;
    skills: string[];
  }[];
  education: string[];
  certifications: string[];
  languages: string[];
  atsAndActionableGaps: string[];
  confidenceFlags: string[];
  contactRedactionPolicy: "contact_data_removed";
};

export type AiCvGenerateEvidence = {
  cvFile: {
    fileId: string;
    mimeType: string;
    sizeBytes: number;
  };
  currentCv: AiCvGenerateStructuredEvidence;
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
  inputVersion: "cv-generate-v2";
  summary: string;
  templateHtml: string;
  evidence: AiCvGenerateEvidence;
  templatePolicy: {
    generationStrategy: "direct_markdown_html_with_backend_template_validation";
    allowedRewriteRegions: string[];
    immutableStructure: string[];
    missingEvidenceBehavior: "leave_empty_or_use_minimal_grounded_copy";
  };
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
