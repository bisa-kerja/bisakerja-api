import { z } from "zod";

import {
  defaultJobRecommendationLimit,
  maxJobRecommendationLimit
} from "@/modules/ai-job-recommendations/ai-job-recommendations.constants";

const recommendationFiltersSchema = z
  .strictObject({
    location: z.string().trim().min(1).max(120).optional(),
    workType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
    experienceLevel: z
      .enum(["ENTRY_LEVEL", "JUNIOR", "MID_LEVEL", "SENIOR", "LEAD"])
      .optional(),
    excludeAppliedJobs: z.boolean().default(true),
    includeBookmarkedStatus: z.boolean().default(true)
  })
  .optional();

export const generateJobRecommendationsSchema = z.strictObject({
  cvAnalysisResultId: z
    .uuid("ID hasil analisis CV tidak valid. Gunakan UUID yang benar")
    .optional(),
  limit: z
    .int()
    .min(1)
    .max(maxJobRecommendationLimit)
    .default(defaultJobRecommendationLimit),
  filters: recommendationFiltersSchema,
  idempotencyKey: z.string().trim().min(1).max(120).optional()
});

export const getJobRecommendationsQuerySchema = z.strictObject({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(maxJobRecommendationLimit)
    .default(defaultJobRecommendationLimit)
});

export const jobRecommendationRunParamsSchema = z.strictObject({
  recommendationRunId: z.uuid(
    "ID run rekomendasi pekerjaan tidak valid. Gunakan UUID yang benar"
  )
});

export type GenerateJobRecommendationsInput = z.infer<
  typeof generateJobRecommendationsSchema
>;
export type GetJobRecommendationsQueryInput = z.infer<
  typeof getJobRecommendationsQuerySchema
>;
export type JobRecommendationRunParamsInput = z.infer<
  typeof jobRecommendationRunParamsSchema
>;
