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
  .min(1, "Nilai filter tidak boleh kosong")
  .max(120, "Nilai filter maksimal 120 karakter")
  .optional();

const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9-]+$/,
    "Slug platform hanya boleh huruf kecil, angka, dan dash"
  )
  .max(80, "Slug platform maksimal 80 karakter")
  .optional();

export const listJobsQuerySchema = z
  .strictObject({
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
    keyword: optionalTrimmedString,
    location: optionalTrimmedString,
    province: optionalTrimmedString,
    city: optionalTrimmedString,
    workType: z.enum(allowedWorkTypes).optional(),
    employmentType: z.enum(allowedEmploymentTypes).optional(),
    experienceLevel: z.enum(allowedExperienceLevels).optional(),
    salaryMin: z.coerce
      .number()
      .int("Gaji minimum harus berupa bilangan bulat")
      .nonnegative("Gaji minimum tidak boleh negatif")
      .optional(),
    salaryMax: z.coerce
      .number()
      .int("Gaji maksimum harus berupa bilangan bulat")
      .nonnegative("Gaji maksimum tidak boleh negatif")
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
        message: "Gaji maksimum harus lebih besar atau sama dengan gaji minimum"
      });
    }
  });

export const jobParamsSchema = z.strictObject({
  jobId: z.uuid("ID lowongan tidak valid. Gunakan UUID yang benar")
});

export type ListJobsQueryInput = z.infer<typeof listJobsQuerySchema>;
export type JobParamsInput = z.infer<typeof jobParamsSchema>;
