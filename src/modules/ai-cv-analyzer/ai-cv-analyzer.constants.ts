export const aiCvAnalyzerErrorCodes = {
  bookmarkNotFound: "BOOKMARK_NOT_FOUND",
  jobNotFound: "JOB_NOT_FOUND",
  cvAnalysisResultNotFound: "CV_ANALYSIS_RESULT_NOT_FOUND",
  cvAnalysisResultUnsupported: "CV_ANALYSIS_RESULT_UNSUPPORTED",
  cvFileNotFound: "CV_FILE_NOT_FOUND"
} as const;

export const aiCvAnalyzerSuccessMessages = {
  activeCvFileRetrieved: "Active CV retrieved successfully",
  completed: "CV analysis completed successfully",
  cvAnalysisResultDetailRetrieved: "CV analysis result retrieved successfully",
  cvAnalysisResultLatestRetrieved:
    "Latest CV analysis result retrieved successfully",
  cvAnalysisResultsRetrieved: "CV analysis results retrieved successfully",
  cvFileUploaded: "CV uploaded successfully"
} as const;

export const defaultPersistCvAnalysisResult = false;
export const defaultCvCompareSource = "JOB_SEARCH" as const;
export const generatedCvUnavailableNote =
  "Generated CV feature is not available yet.";
