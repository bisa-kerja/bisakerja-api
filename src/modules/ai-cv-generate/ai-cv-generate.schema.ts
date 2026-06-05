import { z } from "zod";

import { aiCvGenerateLimits } from "@/modules/ai-cv-generate/ai-cv-generate.constants";

export const generateCvMarkdownSchema = z.strictObject({
  cvFileId: z.uuid("CV file ID is invalid. Use a valid UUID"),
  summary: z
    .string()
    .trim()
    .min(1, "CV summary is required")
    .max(aiCvGenerateLimits.summaryMaxLength),
  templateHtml: z
    .string()
    .trim()
    .min(1, "HTML template is required")
    .max(aiCvGenerateLimits.templateMaxLength)
});

export type GenerateCvMarkdownInput = z.infer<typeof generateCvMarkdownSchema>;
