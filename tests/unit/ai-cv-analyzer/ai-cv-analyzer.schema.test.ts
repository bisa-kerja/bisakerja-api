import { describe, expect, test } from "bun:test";

import { analyzeCvSchema } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.schema";

describe("ai cv analyzer schema", () => {
  test("parses multipart metadata and defaults optional fields", () => {
    const result = analyzeCvSchema.parse({
      jobId: "11111111-1111-4111-8111-111111111111",
      language: "id",
      inputMode: "UPLOAD",
      persistResult: "true"
    });

    expect(result).toEqual({
      jobId: "11111111-1111-4111-8111-111111111111",
      language: "id",
      inputMode: "UPLOAD",
      compareSource: "JOB_SEARCH",
      persistResult: true
    });
  });

  test("rejects cvFileId for upload mode and unknown fields", () => {
    expect(() =>
      analyzeCvSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        language: "id",
        inputMode: "UPLOAD",
        cvFileId: "22222222-2222-4222-8222-222222222222"
      })
    ).toThrow();

    expect(() =>
      analyzeCvSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        language: "id",
        inputMode: "UPLOAD",
        profile: { careerStatus: "EARLY_CAREER" }
      })
    ).toThrow();
  });
});
