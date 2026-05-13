export const asyncJobTypes = [
  "auth.email-verification",
  "auth.password-reset",
  "maintenance.cv-cleanup"
] as const;

export const asyncJobStatuses = [
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "SUCCEEDED",
  "DEAD_LETTER"
] as const;
