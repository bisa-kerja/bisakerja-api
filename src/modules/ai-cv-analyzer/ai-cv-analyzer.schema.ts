import { z } from "zod";

import {
  defaultCvCompareSource,
  defaultPersistCvAnalysisResult
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.constants";

const multipartBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean("Flag persistResult harus bernilai true atau false"));

const multipartStringArraySchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      const values: unknown[] = value;
      return values;
    }

    if (typeof value === "string") {
      return [value];
    }

    return value;
  },
  z.array(z.string().trim().min(1).max(120)).min(1).max(10)
);

export const analyzeCvSchema = z
  .strictObject({
    jobRoles: multipartStringArraySchema,
    language: z.enum(["id", "en"]),
    inputMode: z.enum(["UPLOAD", "REFERENCE"]),
    compareSource: z
      .enum(["BOOKMARK", "JOB_SEARCH", "DIRECT_JOB_DETAIL"])
      .default(defaultCvCompareSource),
    persistResult: multipartBooleanSchema.default(
      defaultPersistCvAnalysisResult
    ),
    cvFileId: z
      .uuid("ID file CV tidak valid. Gunakan UUID yang benar")
      .optional(),
    directJobId: z
      .uuid("ID lowongan tidak valid. Gunakan UUID yang benar")
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.inputMode === "UPLOAD" && value.cvFileId) {
      ctx.addIssue({
        code: "custom",
        path: ["cvFileId"],
        message: "ID file CV tidak boleh dikirim saat mode UPLOAD"
      });
    }

    if (value.compareSource === "DIRECT_JOB_DETAIL" && !value.directJobId) {
      ctx.addIssue({
        code: "custom",
        path: ["directJobId"],
        message: "ID lowongan wajib dikirim untuk DIRECT_JOB_DETAIL"
      });
    }
  });

export type AnalyzeCvInput = z.infer<typeof analyzeCvSchema>;

export const uploadCvFileSchema = z.strictObject({
  setAsActive: multipartBooleanSchema.default(true)
});

export type UploadCvFileInput = z.infer<typeof uploadCvFileSchema>;

export const listCvAnalysisResultsQuerySchema = z.strictObject({
  page: z.coerce
    .number()
    .int("Halaman harus berupa bilangan bulat")
    .min(1, "Halaman minimal 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Batas data harus berupa bilangan bulat")
    .min(1, "Batas data minimal 1")
    .max(50, "Batas data maksimal 50")
    .default(10),
  sortBy: z.literal("analyzedAt").default("analyzedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  cvFileId: z
    .uuid("ID file CV tidak valid. Gunakan UUID yang benar")
    .optional(),
  schemaVersion: z.string().trim().min(1).max(80).optional(),
  inputMode: z.enum(["UPLOAD", "REFERENCE"]).optional(),
  compareSource: z
    .enum(["BOOKMARK", "JOB_SEARCH", "DIRECT_JOB_DETAIL"])
    .optional()
});

export const cvAnalysisResultParamsSchema = z.strictObject({
  analysisResultId: z.uuid(
    "ID hasil analisis CV tidak valid. Gunakan UUID yang benar"
  )
});

export type ListCvAnalysisResultsQueryInput = z.infer<
  typeof listCvAnalysisResultsQuerySchema
>;
export type CvAnalysisResultParamsInput = z.infer<
  typeof cvAnalysisResultParamsSchema
>;
