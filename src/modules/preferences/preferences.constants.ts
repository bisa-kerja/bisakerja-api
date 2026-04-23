export const preferencesErrorCodes = {
  preferencesNotFound: "PREFERENCES_NOT_FOUND",
  invalidSalaryRange: "INVALID_SALARY_RANGE"
} as const;

export const allowedCareerStatuses = [
  "FRESH_GRADUATE",
  "EARLY_CAREER",
  "CAREER_SWITCHER"
] as const;

export const allowedJobSeekingStatuses = [
  "IMMEDIATE",
  "ONE_MONTH",
  "THREE_MONTHS"
] as const;

export const allowedWorkTypes = ["REMOTE", "HYBRID", "ONSITE"] as const;

export const allowedSalaryPeriods = ["MONTHLY", "YEARLY"] as const;
export const defaultSalaryCurrency = "IDR";
export const defaultSalaryPeriod = "MONTHLY";
