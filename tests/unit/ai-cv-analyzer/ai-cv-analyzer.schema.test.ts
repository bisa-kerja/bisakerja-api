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
    const uploadWithCvFileId = analyzeCvSchema.safeParse({
      jobId: "11111111-1111-4111-8111-111111111111",
      language: "id",
      inputMode: "UPLOAD",
      cvFileId: "22222222-2222-4222-8222-222222222222"
    });
    expect(uploadWithCvFileId.success).toBe(false);
    expect(uploadWithCvFileId.error?.issues[0]?.message).toBe(
      "ID file CV tidak boleh dikirim saat mode UPLOAD"
    );

    expect(() =>
      analyzeCvSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        language: "id",
        inputMode: "UPLOAD",
        profile: { careerStatus: "EARLY_CAREER" }
      })
    ).toThrow();
  });

  test("returns friendly message for invalid cvFileId and persistResult", () => {
    const invalidCvFileId = analyzeCvSchema.safeParse({
      jobId: "11111111-1111-4111-8111-111111111111",
      language: "id",
      inputMode: "REFERENCE",
      cvFileId: "not-a-uuid"
    });
    expect(invalidCvFileId.success).toBe(false);
    expect(invalidCvFileId.error?.issues[0]?.message).toBe(
      "ID file CV tidak valid. Gunakan UUID yang benar"
    );

    const invalidPersistResult = analyzeCvSchema.safeParse({
      jobId: "11111111-1111-4111-8111-111111111111",
      language: "id",
      inputMode: "UPLOAD",
      persistResult: "yes"
    });
    expect(invalidPersistResult.success).toBe(false);
    expect(invalidPersistResult.error?.issues[0]?.message).toBe(
      "Flag persistResult harus bernilai true atau false"
    );
  });
});
