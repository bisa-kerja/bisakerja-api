export const aiCvGenerateSuccessMessages = {
  generated: "Markdown CV created successfully"
} as const;

export const aiCvGenerateErrorCodes = {
  cvFileNotFound: "CV_FILE_NOT_FOUND",
  modelOutputInvalid: "MODEL_OUTPUT_INVALID"
} as const;

export const aiCvGenerateLimits = {
  summaryMaxLength: 8000,
  templateMaxLength: 20000,
  markdownMaxLength: 50000
} as const;
