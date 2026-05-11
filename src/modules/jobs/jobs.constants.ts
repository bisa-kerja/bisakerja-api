export {
  allowedEmploymentTypes,
  allowedExperienceLevels,
  allowedWorkTypes,
  hiddenJobDetailStatus as hiddenDetailStatus,
  visibleJobListStatuses as visibleListStatuses
} from "@/shared/constants/domain-vocabulary";

export const allowedJobSorts = [
  "relevance",
  "newest",
  "salary_highest",
  "salary_lowest"
] as const;

export const jobsErrorCodes = {
  jobNotFound: "JOB_NOT_FOUND"
} as const;
