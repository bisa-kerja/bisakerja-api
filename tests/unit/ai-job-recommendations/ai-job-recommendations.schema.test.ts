import { describe, expect, test } from "bun:test";

import {
  generateJobRecommendationsSchema,
  getJobRecommendationsQuerySchema,
  jobRecommendationRunParamsSchema
} from "@/modules/ai-job-recommendations/ai-job-recommendations.schema";

describe("ai job recommendations schema", () => {
  test("defaults limit and filter booleans", () => {
    const parsed = generateJobRecommendationsSchema.parse({});

    expect(parsed.limit).toBe(10);
    expect(parsed.filters).toBeUndefined();
  });

  test("rejects out of range limit and invalid cv id", () => {
    const invalidLimit = generateJobRecommendationsSchema.safeParse({
      limit: 99
    });
    const invalidCvId = generateJobRecommendationsSchema.safeParse({
      cvAnalysisResultId: "invalid-id"
    });

    expect(invalidLimit.success).toBe(false);
    expect(invalidCvId.success).toBe(false);
  });

  test("parses query and params correctly", () => {
    const query = getJobRecommendationsQuerySchema.parse({ limit: "5" });
    const params = jobRecommendationRunParamsSchema.parse({
      recommendationRunId: "11111111-1111-4111-8111-111111111111"
    });

    expect(query.limit).toBe(5);
    expect(params.recommendationRunId).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });
});
