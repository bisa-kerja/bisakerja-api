import { describe, expect, test } from "bun:test";

import { PreferencesService } from "@/modules/preferences";
import { preferencesErrorCodes } from "@/modules/preferences/preferences.constants";
import type { UpsertPreferencesInput } from "@/modules/preferences/preferences.schema";
import { mergePreferences } from "@/modules/preferences/preferences.service";
import type {
  PreferenceOnboardingState,
  PreferenceRecord,
  PreferencesRepository
} from "@/modules/preferences/preferences.types";

const baseDate = new Date("2026-04-23T00:00:00.000Z");

describe("PreferencesService", () => {
  test("returns persisted preference context for AI consumers", async () => {
    const repository = new InMemoryPreferencesRepository();
    await repository.upsertForUser("user-1", validPreferenceInput());

    const service = new PreferencesService(repository);
    const context = await service.getPreferenceContext("user-1");

    expect(context).toEqual({
      targetRoles: ["Backend Developer"],
      locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
      workTypes: ["REMOTE"],
      salaryExpectation: {
        min: 5_000_000,
        max: 10_000_000,
        currency: "IDR",
        period: "MONTHLY"
      }
    });
  });

  test("rejects invalid salary range with documented error code", async () => {
    const service = new PreferencesService(new InMemoryPreferencesRepository());

    try {
      await service.upsertPreferences("user-1", {
        ...validPreferenceInput(),
        salaryExpectation: {
          min: 10_000_000,
          max: 5_000_000,
          currency: "IDR",
          period: "MONTHLY"
        }
      });
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 422,
        code: preferencesErrorCodes.invalidSalaryRange
      });
      return;
    }

    throw new Error("Expected invalid salary range to be rejected");
  });

  test("patch merge preserves untouched fields and allows clearing salary bounds", () => {
    const merged = mergePreferences(validPreferenceRecord(), {
      salaryExpectation: { min: null },
      emailNotificationsEnabled: false
    });

    expect(merged).toMatchObject({
      targetRoles: ["Backend Developer"],
      salaryExpectation: {
        min: null,
        max: 10_000_000,
        currency: "IDR",
        period: "MONTHLY"
      },
      emailNotificationsEnabled: false
    });
  });

  test("upsert syncs onboarding status when preferences complete the profile", async () => {
    const repository = new InMemoryPreferencesRepository({
      emailVerified: true,
      displayName: "Salman Dev",
      phoneNumber: "+6281234567890",
      onboardingStatus: "IN_PROGRESS"
    });
    const service = new PreferencesService(repository);

    await service.upsertPreferences("user-1", validPreferenceInput());

    expect(repository.onboardingStatus).toBe("COMPLETED");
  });
});

function validPreferenceInput(): UpsertPreferencesInput {
  return {
    careerStatus: "FRESH_GRADUATE",
    jobSeekingStatus: "IMMEDIATE",
    targetRoles: ["Backend Developer"],
    locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
    workTypes: ["REMOTE"],
    salaryExpectation: {
      min: 5_000_000,
      max: 10_000_000,
      currency: "IDR",
      period: "MONTHLY"
    },
    emailNotificationsEnabled: true
  };
}

function validPreferenceRecord(): PreferenceRecord {
  return {
    id: "pref-1",
    userId: "user-1",
    ...validPreferenceInput(),
    createdAt: baseDate,
    updatedAt: baseDate
  };
}

class InMemoryPreferencesRepository implements PreferencesRepository {
  private preference: PreferenceRecord | null = null;
  onboardingStatus: PreferenceOnboardingState["onboardingStatus"];

  constructor(
    private readonly onboardingState: PreferenceOnboardingState = {
      emailVerified: false,
      displayName: null,
      phoneNumber: null,
      onboardingStatus: "PENDING"
    }
  ) {
    this.onboardingStatus = onboardingState.onboardingStatus;
  }

  findByUserId(userId: string): Promise<PreferenceRecord | null> {
    return Promise.resolve(
      this.preference?.userId === userId
        ? structuredClone(this.preference)
        : null
    );
  }

  upsertForUser(
    userId: string,
    input: UpsertPreferencesInput
  ): Promise<PreferenceRecord> {
    this.preference = {
      id: this.preference?.id ?? "pref-1",
      userId,
      ...structuredClone(input),
      createdAt: this.preference?.createdAt ?? baseDate,
      updatedAt: new Date(baseDate.getTime() + 1_000)
    };

    return Promise.resolve(structuredClone(this.preference));
  }

  findUserOnboardingState(): Promise<PreferenceOnboardingState | null> {
    return Promise.resolve({
      ...this.onboardingState,
      onboardingStatus: this.onboardingStatus
    });
  }

  updateUserOnboardingStatus(
    _userId: string,
    onboardingStatus: PreferenceOnboardingState["onboardingStatus"]
  ): Promise<void> {
    this.onboardingStatus = onboardingStatus;
    return Promise.resolve();
  }
}
