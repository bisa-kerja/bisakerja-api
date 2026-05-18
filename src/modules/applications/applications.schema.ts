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
    .int("Halaman harus berupa bilangan bulat")
    .min(1, "Halaman minimal 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Batas data harus berupa bilangan bulat")
    .min(1, "Batas data minimal 1")
    .max(100, "Batas data maksimal 100")
    .default(20),
  keyword: z
    .string()
    .trim()
    .min(1, "Kata kunci tidak boleh kosong")
    .max(120, "Kata kunci maksimal 120 karakter")
    .optional(),
  status: z.enum(allowedApplicationStatuses).optional(),
  sort: z.enum(allowedApplicationSorts).default("updated_desc")
});

export const createApplicationSchema = z.strictObject({
  jobId: z.uuid("ID lowongan tidak valid. Gunakan UUID yang benar"),
  status: z.enum(allowedApplicationStatuses).default("APPLIED"),
  notes: z
    .string()
    .trim()
    .max(
      applicationNotesMaxLength,
      `Catatan maksimal ${String(applicationNotesMaxLength)} karakter`
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
            `Catatan maksimal ${String(applicationNotesMaxLength)} karakter`
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
        message: "Minimal satu field pembaruan harus diisi"
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
      `Catatan maksimal ${String(applicationNotesMaxLength)} karakter`
    )
    .optional()
});

export const applicationParamsSchema = z.strictObject({
  applicationId: z.uuid("ID lamaran tidak valid. Gunakan UUID yang benar")
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
