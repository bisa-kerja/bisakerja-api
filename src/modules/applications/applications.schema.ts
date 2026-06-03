import { z } from "zod";

import {
  allowedApplicationSorts,
  allowedApplicationSources,
  allowedApplicationStatuses,
  applicationNotesMaxLength
} from "@/modules/applications/applications.constants";

export const listApplicationsQuerySchema = z.strictObject({
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
  keyword: z
    .string()
    .trim()
    .min(1, "Keyword cannot be empty")
    .max(120, "Keyword must be at most 120 characters")
    .optional(),
  status: z.enum(allowedApplicationStatuses).optional(),
  sort: z.enum(allowedApplicationSorts).default("updated_desc")
});

export const createApplicationSchema = z.strictObject({
  jobId: z.uuid("Job ID is invalid. Use a valid UUID"),
  status: z.enum(allowedApplicationStatuses).default("APPLIED"),
  notes: z
    .string()
    .trim()
    .max(
      applicationNotesMaxLength,
      `Notes must be at most ${String(applicationNotesMaxLength)} characters`
    )
    .optional(),
  source: z.enum(allowedApplicationSources).default("MANUAL")
});

export const updateApplicationSchema = z
  .strictObject({
    notes: z
      .union([
        z
          .string()
          .trim()
          .max(
            applicationNotesMaxLength,
            `Notes must be at most ${String(applicationNotesMaxLength)} characters`
          ),
        z.null()
      ])
      .optional(),
    source: z.enum(allowedApplicationSources).optional()
  })
  .superRefine((value, context) => {
    if (value.notes === undefined && value.source === undefined) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "At least one update field must be provided"
      });
    }
  });

export const updateApplicationStatusSchema = z.strictObject({
  status: z.enum(allowedApplicationStatuses),
  notes: z
    .string()
    .trim()
    .max(
      applicationNotesMaxLength,
      `Notes must be at most ${String(applicationNotesMaxLength)} characters`
    )
    .optional()
});

export const applicationParamsSchema = z.strictObject({
  applicationId: z.uuid("Application ID is invalid. Use a valid UUID")
});

export type ListApplicationsQueryInput = z.infer<
  typeof listApplicationsQuerySchema
>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<
  typeof updateApplicationStatusSchema
>;
export type ApplicationParamsInput = z.infer<typeof applicationParamsSchema>;
