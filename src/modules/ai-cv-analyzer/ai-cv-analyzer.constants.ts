export const aiCvAnalyzerErrorCodes = {
  bookmarkNotFound: "BOOKMARK_NOT_FOUND",
  cvAnalysisResultNotFound: "CV_ANALYSIS_RESULT_NOT_FOUND",
  cvAnalysisResultUnsupported: "CV_ANALYSIS_RESULT_UNSUPPORTED",
  cvFileNotFound: "CV_FILE_NOT_FOUND"
} as const;

export const aiCvAnalyzerSuccessMessages = {
  activeCvFileRetrieved: "CV aktif berhasil diambil",
  completed: "Analisis CV berhasil diselesaikan",
  cvAnalysisResultDetailRetrieved: "Detail hasil analisis CV berhasil diambil",
  cvAnalysisResultLatestRetrieved: "Hasil analisis CV terbaru berhasil diambil",
  cvAnalysisResultsRetrieved: "Daftar hasil analisis CV berhasil diambil",
  cvFileUploaded: "CV berhasil diunggah"
} as const;

export const defaultPersistCvAnalysisResult = false;
export const defaultCvCompareSource = "JOB_SEARCH" as const;
export const generatedCvUnavailableNote =
  "Fitur CV yang dihasilkan belum tersedia.";
