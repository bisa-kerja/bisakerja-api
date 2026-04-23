export const allowedJobSorts = [
  "relevance",
  "newest",
  "salary_highest",
  "salary_lowest"
] as const;

export const allowedWorkTypes = ["REMOTE", "HYBRID", "ONSITE"] as const;

export const allowedEmploymentTypes = [
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "FREELANCE"
] as const;

export const allowedExperienceLevels = [
  "ENTRY_LEVEL",
  "JUNIOR",
  "MID_LEVEL",
  "SENIOR",
  "LEAD"
] as const;

export const visibleListStatuses = ["ACTIVE", "STALE"] as const;

export const hiddenDetailStatus = "HIDDEN";

export const jobsErrorCodes = {
  jobNotFound: "JOB_NOT_FOUND"
} as const;
