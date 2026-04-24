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

export const allowedCareerStatuses = [
  "FRESH_GRADUATE",
  "EARLY_CAREER",
  "CAREER_SWITCHER"
] as const;

export const allowedSalaryPeriods = ["MONTHLY", "YEARLY"] as const;
