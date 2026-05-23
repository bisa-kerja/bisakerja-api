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
  });

export type AnalyzeCvInput = z.infer<typeof analyzeCvSchema>;

export const uploadCvFileSchema = z.strictObject({
  setAsActive: multipartBooleanSchema.default(true)
});

export type UploadCvFileInput = z.infer<typeof uploadCvFileSchema>;
