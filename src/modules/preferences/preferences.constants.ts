export {
  allowedCareerStatuses,
  allowedSalaryPeriods,
  allowedWorkTypes
} from "@/shared/constants/domain-vocabulary";

export const preferencesErrorCodes = {
  preferencesNotFound: "PREFERENCES_NOT_FOUND",
  invalidSalaryRange: "INVALID_SALARY_RANGE"
} as const;

export const allowedJobSeekingStatuses = [
  "IMMEDIATE",
  "ONE_MONTH",
  "THREE_MONTHS"
] as const;
export const defaultSalaryCurrency = "IDR";
export const defaultSalaryPeriod = "MONTHLY";
