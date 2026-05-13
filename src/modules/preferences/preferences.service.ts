import {
  AppError,
  BadRequestError,
  NotFoundError
} from "@/core/errors/app.error";
import { preferencesErrorCodes } from "@/modules/preferences/preferences.constants";
import { upsertPreferencesSchema } from "@/modules/preferences/preferences.schema";
import type {
  MergedPreferenceInput,
  PreferenceContext,
  PreferencePatchInput,
  PreferenceRecord,
  PreferencesRepository
} from "@/modules/preferences/preferences.types";
import { computeOnboardingStatus } from "@/shared/utils/onboarding-status";

export class PreferencesService {
  constructor(private readonly repository: PreferencesRepository) {}

  async getPreferences(userId: string): Promise<PreferenceRecord> {
    return this.requirePreferences(userId);
  }

  async upsertPreferences(
    userId: string,
    input: MergedPreferenceInput
  ): Promise<PreferenceRecord> {
    assertValidSalaryRange(input);

    const preference = await this.repository.upsertForUser(userId, input);
    await this.refreshOnboardingStatus(userId);
    return preference;
  }

  async patchPreferences(
    userId: string,
    input: PreferencePatchInput
  ): Promise<PreferenceRecord> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestError("Minimal satu field harus diisi");
    }

    const existing = await this.requirePreferences(userId);
    const merged = mergePreferences(existing, input);
    const parsed = upsertPreferencesSchema.parse(merged);

    return this.upsertPreferences(userId, parsed);
  }

  async getPreferenceContext(
    userId: string
  ): Promise<PreferenceContext | null> {
    const preference = await this.repository.findByUserId(userId);

    if (!preference) {
      return null;
    }

    return {
      targetRoles: preference.targetRoles,
      locations: preference.locations,
      workTypes: preference.workTypes,
      salaryExpectation: preference.salaryExpectation
    };
  }

  private async requirePreferences(userId: string): Promise<PreferenceRecord> {
    const preference = await this.repository.findByUserId(userId);

    if (!preference) {
      throw new NotFoundError(
        "Preferensi tidak ditemukan",
        preferencesErrorCodes.preferencesNotFound
      );
    }

    return preference;
  }

  private async refreshOnboardingStatus(userId: string): Promise<void> {
    const state = await this.repository.findUserOnboardingState(userId);

    if (!state) {
      return;
    }

    const onboardingStatus = computeOnboardingStatus({
      emailVerified: state.emailVerified,
      displayName: state.displayName,
      phoneNumber: state.phoneNumber,
      hasPreference: true
    });

    if (state.onboardingStatus !== onboardingStatus) {
      await this.repository.updateUserOnboardingStatus(
        userId,
        onboardingStatus
      );
    }
  }
}

export function mergePreferences(
  existing: PreferenceRecord,
  patch: PreferencePatchInput
): MergedPreferenceInput {
  return {
    careerStatus: patch.careerStatus ?? existing.careerStatus,
    jobSeekingStatus: patch.jobSeekingStatus ?? existing.jobSeekingStatus,
    targetRoles: patch.targetRoles ?? existing.targetRoles,
    locations: patch.locations ?? existing.locations,
    workTypes: patch.workTypes ?? existing.workTypes,
    salaryExpectation: {
      min: Object.hasOwn(patch.salaryExpectation ?? {}, "min")
        ? (patch.salaryExpectation?.min ?? null)
        : existing.salaryExpectation.min,
      max: Object.hasOwn(patch.salaryExpectation ?? {}, "max")
        ? (patch.salaryExpectation?.max ?? null)
        : existing.salaryExpectation.max,
      currency:
        patch.salaryExpectation?.currency ??
        existing.salaryExpectation.currency,
      period:
        patch.salaryExpectation?.period ?? existing.salaryExpectation.period
    },
    emailNotificationsEnabled:
      patch.emailNotificationsEnabled ?? existing.emailNotificationsEnabled
  };
}

export function assertValidSalaryRange(input: MergedPreferenceInput): void {
  const { min, max } = input.salaryExpectation;

  if (typeof min === "number" && typeof max === "number" && max < min) {
    throw new AppError({
      statusCode: 422,
      code: preferencesErrorCodes.invalidSalaryRange,
      message: "salaryExpectation.max harus lebih besar atau sama dengan min"
    });
  }
}
