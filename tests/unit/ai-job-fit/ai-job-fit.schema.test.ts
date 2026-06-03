import { describe, expect, test } from "bun:test";

import { analyzeJobFitSchema } from "@/modules/ai-job-fit/ai-job-fit.schema";

describe("ai job fit schema", () => {
  test("defaults persistResult to false", () => {
    const parsed = analyzeJobFitSchema.parse({
      jobId: "11111111-1111-4111-8111-111111111111"
    });

    expect(parsed).toEqual({
      jobId: "11111111-1111-4111-8111-111111111111",
      persistResult: false
    });
  });

  test("rejects injected context fields", () => {
    const result = analyzeJobFitSchema.safeParse({
      jobId: "11111111-1111-4111-8111-111111111111",
      persistResult: true,
      profile: { careerStatus: "EARLY_CAREER" }
    });

    expect(result.success).toBe(false);
  });

  test("returns friendly message for invalid job id", () => {
    const invalid = analyzeJobFitSchema.safeParse({
      jobId: "job_123"
    });

    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.message).toBe(
      "Job ID is invalid. Use a valid UUID"
    );
  });
});
