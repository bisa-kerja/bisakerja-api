import { describe, expect, test } from "bun:test";

import {
  analyzeCvSchema,
  cvAnalysisResultParamsSchema,
  listCvAnalysisResultsQuerySchema
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.schema";

describe("ai cv analyzer schema", () => {
  test("parses multipart metadata and defaults optional fields", () => {
    const result = analyzeCvSchema.parse({
      jobRoles: ["Backend Developer"],
      language: "id",
      inputMode: "UPLOAD",
      persistResult: "true"
    });

    expect(result).toEqual({
      jobRoles: ["Backend Developer"],
      language: "id",
      inputMode: "UPLOAD",
      compareSource: "JOB_SEARCH",
      persistResult: true
    });
  });

  test("rejects cvFileId for upload mode and unknown fields", () => {
    const uploadWithCvFileId = analyzeCvSchema.safeParse({
      jobRoles: ["Backend Developer"],
      language: "id",
      inputMode: "UPLOAD",
      cvFileId: "22222222-2222-4222-8222-222222222222"
    });
    expect(uploadWithCvFileId.success).toBe(false);
    expect(uploadWithCvFileId.error?.issues[0]?.message).toBe(
      "CV file ID must not be sent in UPLOAD mode"
    );

    expect(() =>
      analyzeCvSchema.parse({
        jobRoles: ["Backend Developer"],
        language: "id",
        inputMode: "UPLOAD",
        profile: { careerStatus: "EARLY_CAREER" }
      })
    ).toThrow();
  });

  test("returns friendly message for invalid cvFileId and persistResult", () => {
    const invalidCvFileId = analyzeCvSchema.safeParse({
      jobRoles: ["Backend Developer"],
      language: "id",
      inputMode: "REFERENCE",
      cvFileId: "not-a-uuid"
    });
    expect(invalidCvFileId.success).toBe(false);
    expect(invalidCvFileId.error?.issues[0]?.message).toBe(
      "CV file ID is invalid. Use a valid UUID"
    );

    const invalidPersistResult = analyzeCvSchema.safeParse({
      jobRoles: ["Backend Developer"],
      language: "id",
      inputMode: "UPLOAD",
      persistResult: "yes"
    });
    expect(invalidPersistResult.success).toBe(false);
    expect(invalidPersistResult.error?.issues[0]?.message).toBe(
      "persistResult flag must be true or false"
    );
  });

  test("parses analysis result list query with bounded pagination", () => {
    const result = listCvAnalysisResultsQuerySchema.parse({
      page: "2",
      limit: "50",
      sortOrder: "asc",
      cvFileId: "22222222-2222-4222-8222-222222222222",
      inputMode: "REFERENCE",
      compareSource: "JOB_SEARCH"
    });

    expect(result).toEqual({
      page: 2,
      limit: 50,
      sortBy: "analyzedAt",
      sortOrder: "asc",
      cvFileId: "22222222-2222-4222-8222-222222222222",
      inputMode: "REFERENCE",
      compareSource: "JOB_SEARCH"
    });
    expect(
      listCvAnalysisResultsQuerySchema.safeParse({ limit: "51" }).success
    ).toBe(false);
  });

  test("validates analysis result params", () => {
    expect(
      cvAnalysisResultParamsSchema.parse({
        analysisResultId: "11111111-1111-4111-8111-111111111111"
      })
    ).toEqual({ analysisResultId: "11111111-1111-4111-8111-111111111111" });
    expect(
      cvAnalysisResultParamsSchema.safeParse({ analysisResultId: "latest" })
        .success
    ).toBe(false);
  });
});
