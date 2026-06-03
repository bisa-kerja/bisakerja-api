export const aiJobRecommendationsErrorCodes = {
  cvAnalysisRequired: "CV_ANALYSIS_REQUIRED",
  cvAnalysisResultNotFound: "CV_ANALYSIS_RESULT_NOT_FOUND",
  jobRecommendationNotFound: "JOB_RECOMMENDATION_NOT_FOUND",
  modelResponseInvalid: "MODEL_RESPONSE_INVALID",
  modelServiceUnavailable: "MODEL_SERVICE_UNAVAILABLE"
} as const;

export const aiJobRecommendationsSuccessMessages = {
  generated: "Job recommendations created successfully",
  latestRetrieved: "Latest job recommendations retrieved successfully",
  detailRetrieved: "Job recommendation detail retrieved successfully"
} as const;

export const defaultJobRecommendationLimit = 10;
export const maxJobRecommendationLimit = 20;
export const maxModelCandidateJobs = 50;
