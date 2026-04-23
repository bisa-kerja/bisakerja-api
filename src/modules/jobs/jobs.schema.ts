import { z } from "zod";

import {
  allowedEmploymentTypes,
  allowedExperienceLevels,
  allowedJobSorts,
  allowedWorkTypes
} from "@/modules/jobs/jobs.constants";

const optionalTrimmedString = z.string().trim().min(1).max(120).optional();

const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+$/)
  .max(80)
  .optional();

export const listJobsQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    keyword: optionalTrimmedString,
    location: optionalTrimmedString,
    province: optionalTrimmedString,
    city: optionalTrimmedString,
    workType: z.enum(allowedWorkTypes).optional(),
    employmentType: z.enum(allowedEmploymentTypes).optional(),
    experienceLevel: z.enum(allowedExperienceLevels).optional(),
    salaryMin: z.coerce.number().int().nonnegative().optional(),
    salaryMax: z.coerce.number().int().nonnegative().optional(),
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
        message: "salaryMax must be greater than or equal to salaryMin"
      });
    }
  });

export const jobParamsSchema = z.strictObject({
  jobId: z.uuid()
});

export type ListJobsQueryInput = z.infer<typeof listJobsQuerySchema>;
export type JobParamsInput = z.infer<typeof jobParamsSchema>;
