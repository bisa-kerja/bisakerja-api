import { describe, expect, test } from "bun:test";

import { computeOnboardingStatus } from "@/shared/utils/onboarding-status";

describe("computeOnboardingStatus", () => {
  test("returns pending when no completion signal exists", () => {
    expect(
      computeOnboardingStatus({
        emailVerified: false,
        displayName: null,
        phoneNumber: null,
        hasPreference: false
      })
    ).toBe("PENDING");
  });

  test("returns in progress when any completion signal exists", () => {
    expect(
      computeOnboardingStatus({
        emailVerified: true,
        displayName: null,
        phoneNumber: null,
        hasPreference: false
      })
    ).toBe("IN_PROGRESS");
    expect(
      computeOnboardingStatus({
        emailVerified: false,
        displayName: "Salman",
        phoneNumber: null,
        hasPreference: false
      })
    ).toBe("IN_PROGRESS");
  });

  test("returns completed only when all completion criteria exist", () => {
    expect(
      computeOnboardingStatus({
        emailVerified: true,
        displayName: "Salman",
        phoneNumber: "+6281234567890",
        hasPreference: true
      })
    ).toBe("COMPLETED");
  });

  test("ignores blank string profile fields", () => {
    expect(
      computeOnboardingStatus({
        emailVerified: false,
        displayName: "   ",
        phoneNumber: "   ",
        hasPreference: false
      })
    ).toBe("PENDING");
  });
});
