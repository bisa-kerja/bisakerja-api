export const aiCvAnalyzerErrorCodes = {
  bookmarkNotFound: "BOOKMARK_NOT_FOUND",
  cvFileNotFound: "CV_FILE_NOT_FOUND"
} as const;

export const aiCvAnalyzerSuccessMessages = {
  activeCvFileRetrieved: "CV aktif berhasil diambil",
  completed: "Analisis CV berhasil diselesaikan",
  cvFileUploaded: "CV berhasil diunggah"
} as const;

export const defaultPersistCvAnalysisResult = false;
export const defaultCvCompareSource = "JOB_SEARCH" as const;
export const generatedCvUnavailableNote =
  "Fitur CV yang dihasilkan belum tersedia.";
