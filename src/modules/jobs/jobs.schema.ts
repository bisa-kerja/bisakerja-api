import { z } from "zod";

import {
  allowedEmploymentTypes,
  allowedExperienceLevels,
  allowedJobSorts,
  allowedWorkTypes
} from "@/modules/jobs/jobs.constants";

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1, "Filter value cannot be empty")
  .max(120, "Filter value must be at most 120 characters")
  .optional();

const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9-]+$/,
    "Platform slug may only contain lowercase letters, numbers, and dashes"
  )
  .max(80, "Platform slug must be at most 80 characters")
  .optional();

export const listJobsQuerySchema = z
  .strictObject({
    page: z.coerce
      .number()
      .int("Page must be an integer")
      .min(1, "Page must be at least 1")
      .default(1),
    limit: z.coerce
      .number()
      .int("Limit must be an integer")
      .min(1, "Limit must be at least 1")
      .max(100, "Limit must be at most 100")
      .default(20),
    keyword: optionalTrimmedString,
    location: optionalTrimmedString,
    province: optionalTrimmedString,
    city: optionalTrimmedString,
    workType: z.enum(allowedWorkTypes).optional(),
    employmentType: z.enum(allowedEmploymentTypes).optional(),
    experienceLevel: z.enum(allowedExperienceLevels).optional(),
    salaryMin: z.coerce
      .number()
      .int("Minimum salary must be an integer")
      .nonnegative("Minimum salary cannot be negative")
      .optional(),
    salaryMax: z.coerce
      .number()
      .int("Maximum salary must be an integer")
      .nonnegative("Maximum salary cannot be negative")
      .optional(),
    sourcePlatform: optionalSlug,
    skill: optionalTrimmedString,
    category: optionalTrimmedString,
    sort: z.enum(allowedJobSorts).default("relevance")
  })
  .superRefine((query, context) => {
    if (
      typeof query.salaryMin === "number" &&
      typeof query.salaryMax === "number" &&
      query.salaryMax < query.salaryMin
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message:
          "Maximum salary must be greater than or equal to minimum salary"
      });
    }
  });

export const jobParamsSchema = z.strictObject({
  jobId: z.uuid("Job ID is invalid. Use a valid UUID")
});

export type ListJobsQueryInput = z.infer<typeof listJobsQuerySchema>;
export type JobParamsInput = z.infer<typeof jobParamsSchema>;
