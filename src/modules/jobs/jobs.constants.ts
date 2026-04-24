export {
  allowedEmploymentTypes,
  allowedExperienceLevels,
  allowedWorkTypes
} from "@/shared/constants/domain-vocabulary";

export const allowedJobSorts = [
  "relevance",
  "newest",
  "salary_highest",
  "salary_lowest"
] as const;

export const visibleListStatuses = ["ACTIVE", "STALE"] as const;

export const hiddenDetailStatus = "HIDDEN";

export const jobsErrorCodes = {
  jobNotFound: "JOB_NOT_FOUND"
} as const;
