import { z } from "zod";

import { defaultPersistJobFitResult } from "@/modules/ai-job-fit/ai-job-fit.constants";

export const analyzeJobFitSchema = z.strictObject({
  jobId: z.uuid(),
  persistResult: z.boolean().default(defaultPersistJobFitResult)
});

export type AnalyzeJobFitInput = z.infer<typeof analyzeJobFitSchema>;
