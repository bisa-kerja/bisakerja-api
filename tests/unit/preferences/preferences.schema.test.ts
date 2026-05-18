import { describe, expect, test } from "bun:test";

import {
  patchPreferencesSchema,
  upsertPreferencesSchema
} from "@/modules/preferences/preferences.schema";

describe("preferences schemas", () => {
  test("normalizes full preference payload", () => {
    const parsed = upsertPreferencesSchema.parse({
      careerStatus: "FRESH_GRADUATE",
      jobSeekingStatus: "IMMEDIATE",
      targetRoles: ["  Backend   Developer  "],
      locations: [{ province: " DKI   Jakarta ", city: " Jakarta Selatan " }],
      workTypes: ["REMOTE"],
      salaryExpectation: {
        min: 5_000_000,
        max: 10_000_000
      },
      emailNotificationsEnabled: true
    });

    expect(parsed).toMatchObject({
      targetRoles: ["Backend Developer"],
      locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
      salaryExpectation: {
        min: 5_000_000,
        max: 10_000_000,
        currency: "IDR",
        period: "MONTHLY"
      }
    });
  });

  test("rejects unsupported enum values and userId injection", () => {
    expect(() =>
      upsertPreferencesSchema.parse({
        careerStatus: "STUDENT",
        jobSeekingStatus: "IMMEDIATE",
        targetRoles: ["Backend Developer"],
        locations: [{ province: "DKI Jakarta" }],
        workTypes: ["REMOTE"],
        salaryExpectation: {},
        emailNotificationsEnabled: true
      })
    ).toThrow();

    expect(() =>
      patchPreferencesSchema.parse({
        userId: "another-user"
      })
    ).toThrow();
  });

  test("rejects duplicate target roles after normalization", () => {
    const duplicate = upsertPreferencesSchema.safeParse({
      careerStatus: "EARLY_CAREER",
      jobSeekingStatus: "ONE_MONTH",
      targetRoles: ["Backend Developer", " backend   developer "],
      locations: [{ province: "DKI Jakarta" }],
      workTypes: ["HYBRID"],
      salaryExpectation: {},
      emailNotificationsEnabled: false
    });

    expect(duplicate.success).toBe(false);
    expect(duplicate.error?.issues[0]?.message).toBe(
      "Target peran tidak boleh duplikat"
    );
  });

  test("rejects salary expectation max below min with friendly message", () => {
    const invalid = patchPreferencesSchema.safeParse({
      salaryExpectation: { min: 10_000_000, max: 5_000_000 }
    });

    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.path.join(".")).toBe(
      "salaryExpectation.max"
    );
    expect(invalid.error?.issues[0]?.message).toBe(
      "Ekspektasi gaji maksimum harus lebih besar atau sama dengan minimum"
    );
  });
});
