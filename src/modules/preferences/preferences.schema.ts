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
  .min(1)
  .max(120)
  .transform((value) => normalizeWhitespace(value));

const targetRolesSchema = z
  .array(targetRoleSchema)
  .min(1)
  .max(20)
  .superRefine((roles, context) => {
    const seen = new Set<string>();

    roles.forEach((role, index) => {
      const key = toPreferenceRoleKey(role);
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Duplicate target roles are not allowed"
        });
      }
      seen.add(key);
    });
  });

const locationSchema = z.strictObject({
  province: z
    .string()
    .min(1)
    .max(120)
    .transform((value) => normalizeWhitespace(value)),
  city: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => normalizeOptionalWhitespace(value))
});

const locationsSchema = z.array(locationSchema).min(1).max(20);

export const salaryExpectationSchema = z
  .strictObject({
    min: z.int().nonnegative().optional().nullable().default(null),
    max: z.int().nonnegative().optional().nullable().default(null),
    currency: z
      .string()
      .trim()
      .min(3)
      .max(3)
      .transform((value) => value.toUpperCase())
      .default(defaultSalaryCurrency),
    period: z.enum(allowedSalaryPeriods).default(defaultSalaryPeriod)
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
  workTypes: z.array(z.enum(allowedWorkTypes)).min(1).max(3),
  salaryExpectation: salaryExpectationSchema,
  emailNotificationsEnabled: z.boolean()
});

const partialSalaryExpectationSchema = z.strictObject({
  min: z.int().nonnegative().optional().nullable(),
  max: z.int().nonnegative().optional().nullable(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  period: z.enum(allowedSalaryPeriods).optional()
});

export const patchPreferencesSchema = z.strictObject({
  careerStatus: z.enum(allowedCareerStatuses).optional(),
  jobSeekingStatus: z.enum(allowedJobSeekingStatuses).optional(),
  targetRoles: targetRolesSchema.optional(),
  locations: locationsSchema.optional(),
  workTypes: z.array(z.enum(allowedWorkTypes)).min(1).max(3).optional(),
  salaryExpectation: partialSalaryExpectationSchema.optional(),
  emailNotificationsEnabled: z.boolean().optional()
});

export type UpsertPreferencesInput = z.infer<typeof upsertPreferencesSchema>;
export type PatchPreferencesInput = z.infer<typeof patchPreferencesSchema>;
export type SalaryExpectationInput = z.infer<typeof salaryExpectationSchema>;
