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
}, z.boolean());

export const analyzeCvSchema = z
  .strictObject({
    jobId: z.uuid(),
    language: z.enum(["id", "en"]),
    inputMode: z.enum(["UPLOAD", "REFERENCE"]),
    compareSource: z
      .enum(["BOOKMARK", "JOB_SEARCH", "DIRECT_JOB_DETAIL"])
      .default(defaultCvCompareSource),
    persistResult: multipartBooleanSchema.default(
      defaultPersistCvAnalysisResult
    ),
    cvFileId: z.uuid().optional()
  })
  .superRefine((value, ctx) => {
    if (value.inputMode === "UPLOAD" && value.cvFileId) {
      ctx.addIssue({
        code: "custom",
        path: ["cvFileId"],
        message: "cvFileId is not supported for UPLOAD mode"
      });
    }
  });

export type AnalyzeCvInput = z.infer<typeof analyzeCvSchema>;
