export const allowedApplicationStatuses = [
  "APPLIED",
  "INTERVIEW",
  "REJECTED",
  "ACCEPTED"
] as const;

export const allowedApplicationSources = [
  "MANUAL",
  "EXTERNAL_APPLY_CLICK"
] as const;

export const allowedApplicationSorts = [
  "updated_desc",
  "created_desc",
  "newest"
] as const;

export const applicationNotesMaxLength = 2000;

export const applicationsErrorCodes = {
  applicationAlreadyTracked: "APPLICATION_ALREADY_TRACKED",
  applicationNotFound: "APPLICATION_NOT_FOUND",
  applicationStatusConflict: "APPLICATION_STATUS_CONFLICT",
  jobNotFound: "JOB_NOT_FOUND"
} as const;

export const allowedStatusTransitions = {
  APPLIED: ["INTERVIEW", "REJECTED", "ACCEPTED"],
  INTERVIEW: ["REJECTED", "ACCEPTED", "APPLIED"],
  REJECTED: ["APPLIED", "INTERVIEW", "ACCEPTED"],
  ACCEPTED: ["APPLIED", "INTERVIEW", "REJECTED"]
} as const;
