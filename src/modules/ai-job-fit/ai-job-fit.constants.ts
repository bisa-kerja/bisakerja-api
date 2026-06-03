export const aiJobFitErrorCodes = {
  jobNotFound: "JOB_NOT_FOUND",
  profileIncomplete: "PROFILE_INCOMPLETE",
  preferencesIncomplete: "PREFERENCES_INCOMPLETE"
} as const;

export const aiJobFitSuccessMessages = {
  completed: "Job fit analysis completed successfully"
} as const;

export const defaultPersistJobFitResult = false;
