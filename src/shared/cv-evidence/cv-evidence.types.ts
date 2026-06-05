export type SharedCvEvidenceSource =
  | "model_api"
  | "backend_parser"
  | "latest_analysis_cache"
  | "metadata_only";

export type SharedCvEvidenceParserOwner =
  | "backend_mvp"
  | "model_api_primary"
  | "hybrid_fallback";

export type SharedCvEvidenceConfidence = "high" | "medium" | "low";

export type SharedCvEvidenceCacheStatus = "hit" | "miss" | "bypass";

export type SharedCvEvidenceSection = {
  sectionName: string;
  summary: string;
  confidence: SharedCvEvidenceConfidence;
  items: string[];
};

export type SharedCvEvidenceSkillGroup = {
  category: string;
  skills: string[];
};

export type SharedCvEvidenceRequirementCoverage = {
  requirement: string;
  status: "matched" | "missing" | "unknown";
  evidence: string[];
};

export type SharedCvEvidenceInvalidationPolicy = {
  sourceHash: string;
  parserVersion: string;
  analysisModelVersion: string | null;
  templatePolicyVersion: string | null;
  expiresAt: string;
};

export type SharedCvEvidenceRetentionPolicy = {
  retainedFields: string[];
  forbiddenFields: string[];
  expiresAt: string;
};

export type SharedCvEvidenceCache = {
  key: string;
  status: SharedCvEvidenceCacheStatus;
  createdAt: string;
  expiresAt: string;
  invalidationPolicy: SharedCvEvidenceInvalidationPolicy;
  retentionPolicy: SharedCvEvidenceRetentionPolicy;
};

export type SharedCvEvidence = {
  schemaVersion: "shared-cv-evidence-v1";
  source: SharedCvEvidenceSource;
  parserOwner: SharedCvEvidenceParserOwner;
  parserVersion: string;
  parserConfidence: SharedCvEvidenceConfidence;
  sourceHash: string;
  cvFile: {
    fileId: string;
    mimeType: string;
    fileSize: number;
  };
  cache: SharedCvEvidenceCache;
  candidateSummary: string | null;
  sectionEvidence: SharedCvEvidenceSection[];
  sectionSummaries: {
    sectionName: string;
    summary: string;
    confidence: SharedCvEvidenceConfidence;
  }[];
  experienceBullets: string[];
  projectBullets: string[];
  skillEvidence: {
    skillsByCategory: SharedCvEvidenceSkillGroup[];
    requirementCoverage: SharedCvEvidenceRequirementCoverage[];
  };
  skillsByCategory: SharedCvEvidenceSkillGroup[];
  education: string[];
  certifications: string[];
  languages: string[];
  atsEvidence: {
    score: number | null;
    summary: string | null;
    actionables: string[];
  };
  atsAndActionableGaps: string[];
  confidenceFlags: string[];
  contactRedactionPolicy: "contact_data_removed";
  privacy: {
    rawCvTextRetained: false;
    contactDataRetained: false;
    promptsRetained: false;
    providerPayloadRetained: false;
    storageIdentifierRetained: false;
  };
};

export type SharedCvEvidenceLatestAnalysis = {
  jobFitAlignment?: unknown;
  atsFriendliness?: unknown;
  overallImpression?: string;
  topActionables?: unknown;
  sectionReviews?: unknown;
} | null;

export type SharedCvEvidenceMetadata = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt?: Date;
  expiresAt?: Date;
};

export type BuildSharedCvEvidenceInput = {
  metadata: SharedCvEvidenceMetadata;
  cvBytes?: Buffer;
  latestAnalysis?: SharedCvEvidenceLatestAnalysis;
  modelCoreResponse?: {
    parsedCv: {
      status: string;
      pageCount: number;
      textLength: number;
      detectedSections: string[];
      extractionEvidence?: string[] | null;
    };
    jobFitAlignment: unknown;
    atsFriendliness: unknown;
    model: {
      name: string;
      version: string;
    };
  };
  now: Date;
  retentionDays: number;
  templatePolicyVersion?: string | null;
  cacheStatus?: SharedCvEvidenceCacheStatus;
};

export type SharedCvEvidenceFreshnessInput = {
  sourceHash: string;
  parserVersion: string;
  analysisModelVersion?: string | null;
  templatePolicyVersion?: string | null;
  now: Date;
};

export type SharedCvEvidenceObservability = {
  schemaVersion: SharedCvEvidence["schemaVersion"];
  source: SharedCvEvidenceSource;
  parserOwner: SharedCvEvidenceParserOwner;
  parserVersion: string;
  parserConfidence: SharedCvEvidenceConfidence;
  cacheStatus: SharedCvEvidenceCacheStatus;
  sectionCount: number;
  skillCount: number;
  requirementCoverageCount: number;
  actionablesCount: number;
  noLeakChecks: {
    rawCvTextRetained: false;
    contactDataRetained: false;
    storageIdentifierRetained: false;
  };
};
