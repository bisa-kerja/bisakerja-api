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
  .min(1, "Target peran wajib diisi")
  .max(120, "Target peran maksimal 120 karakter")
  .transform((value) => normalizeWhitespace(value));

const targetRolesSchema = z
  .array(targetRoleSchema)
  .min(1, "Minimal satu target peran wajib diisi")
  .max(20, "Maksimal 20 target peran")
  .superRefine((roles, context) => {
    const seen = new Set<string>();

    roles.forEach((role, index) => {
      const key = toPreferenceRoleKey(role);
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Target peran tidak boleh duplikat"
        });
      }
      seen.add(key);
    });
  });

const locationSchema = z.strictObject({
  province: z
    .string()
    .min(1, "Provinsi wajib diisi")
    .max(120, "Provinsi maksimal 120 karakter")
    .transform((value) => normalizeWhitespace(value)),
  city: z
    .string()
    .max(120, "Kota maksimal 120 karakter")
    .optional()
    .nullable()
    .transform((value) => normalizeOptionalWhitespace(value))
});

const locationsSchema = z
  .array(locationSchema)
  .min(1, "Minimal satu lokasi target wajib diisi")
  .max(20, "Maksimal 20 lokasi target");

export const salaryExpectationSchema = z
  .strictObject({
    min: z
      .int("Ekspektasi gaji minimum harus berupa angka")
      .nonnegative("Ekspektasi gaji minimum tidak boleh negatif")
      .optional()
      .nullable()
      .default(null),
    max: z
      .int("Ekspektasi gaji maksimum harus berupa angka")
      .nonnegative("Ekspektasi gaji maksimum tidak boleh negatif")
      .optional()
      .nullable()
      .default(null),
    currency: z
      .string()
      .trim()
      .min(3, "Mata uang gaji harus 3 karakter")
      .max(3, "Mata uang gaji harus 3 karakter")
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
          "Ekspektasi gaji maksimum harus lebih besar atau sama dengan minimum"
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
    .min(1, "Minimal satu tipe kerja wajib diisi")
    .max(3, "Maksimal 3 tipe kerja"),
  salaryExpectation: salaryExpectationSchema,
  emailNotificationsEnabled: z.boolean()
});

const partialSalaryExpectationSchema = z
  .strictObject({
    min: z
      .int("Ekspektasi gaji minimum harus berupa angka")
      .nonnegative("Ekspektasi gaji minimum tidak boleh negatif")
      .optional()
      .nullable(),
    max: z
      .int("Ekspektasi gaji maksimum harus berupa angka")
      .nonnegative("Ekspektasi gaji maksimum tidak boleh negatif")
      .optional()
      .nullable(),
    currency: z
      .string()
      .trim()
      .min(3, "Mata uang gaji harus 3 karakter")
      .max(3, "Mata uang gaji harus 3 karakter")
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
          "Ekspektasi gaji maksimum harus lebih besar atau sama dengan minimum"
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
    .min(1, "Minimal satu tipe kerja wajib diisi")
    .max(3, "Maksimal 3 tipe kerja")
    .optional(),
  salaryExpectation: partialSalaryExpectationSchema.optional(),
  emailNotificationsEnabled: z.boolean().optional()
});

export type UpsertPreferencesInput = z.infer<typeof upsertPreferencesSchema>;
export type PatchPreferencesInput = z.infer<typeof patchPreferencesSchema>;
export type SalaryExpectationInput = z.infer<typeof salaryExpectationSchema>;
