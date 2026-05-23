import { z } from "zod";

import { aiCvGenerateLimits } from "@/modules/ai-cv-generate/ai-cv-generate.constants";

export const generateCvMarkdownSchema = z.strictObject({
  cvFileId: z.uuid("ID file CV tidak valid. Gunakan UUID yang benar"),
  summary: z
    .string()
    .trim()
    .min(1, "Ringkasan CV wajib diisi")
    .max(aiCvGenerateLimits.summaryMaxLength),
  templateHtml: z
    .string()
    .trim()
    .min(1, "Template HTML wajib diisi")
    .max(aiCvGenerateLimits.templateMaxLength)
});

export type GenerateCvMarkdownInput = z.infer<typeof generateCvMarkdownSchema>;
