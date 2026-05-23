export const modelApiInputVersions = {
  jobFit: "job-fit-v1",
  cvAnalyzer: "cv-analyzer-v1",
  jobRecommendations: "job-recommendations-v1",
  cvGenerate: "cv-generate-v1"
} as const;

export const allowedJobFitReadinessLevels = [
  "READY",
  "READY_WITH_MINOR_GAPS",
  "NEEDS_PREPARATION",
  "NOT_RECOMMENDED_YET"
] as const;

export const allowedJobFitRecommendationDecisions = [
  "APPLY_NOW",
  "IMPROVE_FIRST",
  "SAVE_FOR_LATER",
  "NOT_RECOMMENDED"
] as const;

export const allowedSkillGapPriorities = ["HIGH", "MEDIUM", "LOW"] as const;

export const allowedRequirementTypes = [
  "SKILL",
  "EXPERIENCE",
  "EDUCATION",
  "RESPONSIBILITY",
  "OTHER"
] as const;

export const allowedRequirementPriorities = ["HIGH", "MEDIUM", "LOW"] as const;

export const allowedAnalysisLanguages = ["ID", "EN"] as const;

export const allowedCvInputModes = ["UPLOAD", "REFERENCE"] as const;

export const allowedCvCompareSources = [
  "BOOKMARK",
  "JOB_SEARCH",
  "DIRECT_JOB_DETAIL"
] as const;

export const allowedJobRecommendationMatchLevels = [
  "strong",
  "good",
  "stretch"
] as const;
