import { z } from "zod";

import {
  allowedCareerStatuses,
  allowedJobSeekingStatuses,
  allowedSalaryPeriods,
  allowedWorkTypes,
  defaultSalaryCurrency,
  defaultSalaryPeriod
} from "@/modules/preferences/preferences.constants";
import { toPreferenceRoleKey } from "@/modules/preferences/preferences.utils";
import {
  normalizeOptionalWhitespace,
  normalizeWhitespace
} from "@/shared/utils/text";

const targetRoleSchema = z
  .string()
  .min(1, "Target role is required")
  .max(120, "Target role must be at most 120 characters")
  .transform((value) => normalizeWhitespace(value));

const targetRolesSchema = z
  .array(targetRoleSchema)
  .min(1, "At least one target role is required")
  .max(20, "At most 20 target roles are allowed")
  .superRefine((roles, context) => {
    const seen = new Set<string>();

    roles.forEach((role, index) => {
      const key = toPreferenceRoleKey(role);
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Target roles must not be duplicated"
        });
      }
      seen.add(key);
    });
  });

const locationSchema = z.strictObject({
  province: z
    .string()
    .min(1, "Province is required")
    .max(120, "Province must be at most 120 characters")
    .transform((value) => normalizeWhitespace(value)),
  city: z
    .string()
    .max(120, "City must be at most 120 characters")
    .optional()
    .nullable()
    .transform((value) => normalizeOptionalWhitespace(value))
});

const locationsSchema = z
  .array(locationSchema)
  .min(1, "At least one target location is required")
  .max(20, "At most 20 target locations are allowed");

export const salaryExpectationSchema = z
  .strictObject({
    min: z
      .int("Minimum salary expectation must be an integer")
      .nonnegative("Minimum salary expectation cannot be negative")
      .optional()
      .nullable()
      .default(null),
    max: z
      .int("Maximum salary expectation must be an integer")
      .nonnegative("Maximum salary expectation cannot be negative")
      .optional()
      .nullable()
      .default(null),
    currency: z
      .string()
      .trim()
      .min(3, "Salary currency must be 3 characters")
      .max(3, "Salary currency must be 3 characters")
      .transform((value) => value.toUpperCase())
      .default(defaultSalaryCurrency),
    period: z.enum(allowedSalaryPeriods).default(defaultSalaryPeriod)
  })
  .superRefine((value, context) => {
    if (
      typeof value.min === "number" &&
      typeof value.max === "number" &&
      value.max < value.min
    ) {
      context.addIssue({
        code: "custom",
        path: ["max"],
        message:
          "Maximum salary expectation must be greater than or equal to minimum"
      });
    }
  })
  .default({
    min: null,
    max: null,
    currency: defaultSalaryCurrency,
    period: defaultSalaryPeriod
  });

export const upsertPreferencesSchema = z.strictObject({
  careerStatus: z.enum(allowedCareerStatuses),
  jobSeekingStatus: z.enum(allowedJobSeekingStatuses),
  targetRoles: targetRolesSchema,
  locations: locationsSchema,
  workTypes: z
    .array(z.enum(allowedWorkTypes))
    .min(1, "At least one work type is required")
    .max(3, "At most 3 work types are allowed"),
  salaryExpectation: salaryExpectationSchema,
  emailNotificationsEnabled: z.boolean()
});

const partialSalaryExpectationSchema = z
  .strictObject({
    min: z
      .int("Minimum salary expectation must be an integer")
      .nonnegative("Minimum salary expectation cannot be negative")
      .optional()
      .nullable(),
    max: z
      .int("Maximum salary expectation must be an integer")
      .nonnegative("Maximum salary expectation cannot be negative")
      .optional()
      .nullable(),
    currency: z
      .string()
      .trim()
      .min(3, "Salary currency must be 3 characters")
      .max(3, "Salary currency must be 3 characters")
      .transform((value) => value.toUpperCase())
      .optional(),
    period: z.enum(allowedSalaryPeriods).optional()
  })
  .superRefine((value, context) => {
    if (
      typeof value.min === "number" &&
      typeof value.max === "number" &&
      value.max < value.min
    ) {
      context.addIssue({
        code: "custom",
        path: ["max"],
        message:
          "Maximum salary expectation must be greater than or equal to minimum"
      });
    }
  });

export const patchPreferencesSchema = z.strictObject({
  careerStatus: z.enum(allowedCareerStatuses).optional(),
  jobSeekingStatus: z.enum(allowedJobSeekingStatuses).optional(),
  targetRoles: targetRolesSchema.optional(),
  locations: locationsSchema.optional(),
  workTypes: z
    .array(z.enum(allowedWorkTypes))
    .min(1, "At least one work type is required")
    .max(3, "At most 3 work types are allowed")
    .optional(),
  salaryExpectation: partialSalaryExpectationSchema.optional(),
  emailNotificationsEnabled: z.boolean().optional()
});

export type UpsertPreferencesInput = z.infer<typeof upsertPreferencesSchema>;
export type PatchPreferencesInput = z.infer<typeof patchPreferencesSchema>;
export type SalaryExpectationInput = z.infer<typeof salaryExpectationSchema>;
