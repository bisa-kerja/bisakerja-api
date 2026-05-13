import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type { UpsertPreferencesInput } from "@/modules/preferences/preferences.schema";
import type {
  PreferenceLocation,
  PreferenceRecord,
  PreferencesRepository,
  PreferenceWorkType
} from "@/modules/preferences/preferences.types";

type PrismaClientLike = typeof prisma | PrismaTransaction;

export class PrismaPreferencesRepository implements PreferencesRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async findByUserId(userId: string): Promise<PreferenceRecord | null> {
    const preference = await this.client.userPreference.findUnique({
      where: { userId }
    });

    return preference ? mapPreference(preference) : null;
  }

  async upsertForUser(
    userId: string,
    input: UpsertPreferencesInput
  ): Promise<PreferenceRecord> {
    const preference = await this.client.userPreference.upsert({
      where: { userId },
      update: toPreferencePersistence(input),
      create: {
        userId,
        ...toPreferencePersistence(input)
      }
    });

    return mapPreference(preference);
  }

  async findUserOnboardingState(userId: string) {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: {
        emailVerifiedAt: true,
        displayName: true,
        phoneNumber: true,
        onboardingStatus: true
      }
    });

    if (!user) {
      return null;
    }

    return {
      emailVerified: Boolean(user.emailVerifiedAt),
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      onboardingStatus: user.onboardingStatus
    };
  }

  async updateUserOnboardingStatus(
    userId: string,
    onboardingStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: { onboardingStatus }
    });
  }
}

function toPreferencePersistence(input: UpsertPreferencesInput) {
  return {
    careerStatus: input.careerStatus,
    jobSeekingStatus: input.jobSeekingStatus,
    targetRoles: input.targetRoles as Prisma.InputJsonValue,
    locations: input.locations as Prisma.InputJsonValue,
    workTypes: input.workTypes,
    salaryMin: input.salaryExpectation.min,
    salaryMax: input.salaryExpectation.max,
    salaryCurrency: input.salaryExpectation.currency,
    salaryPeriod: input.salaryExpectation.period,
    emailNotificationsEnabled: input.emailNotificationsEnabled
  };
}

function mapPreference(preference: {
  id: string;
  userId: string;
  careerStatus: PreferenceRecord["careerStatus"];
  jobSeekingStatus: PreferenceRecord["jobSeekingStatus"];
  targetRoles: unknown;
  locations: unknown;
  workTypes: PreferenceWorkType[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: PreferenceRecord["salaryExpectation"]["period"];
  emailNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PreferenceRecord {
  return {
    id: preference.id,
    userId: preference.userId,
    careerStatus: preference.careerStatus,
    jobSeekingStatus: preference.jobSeekingStatus,
    targetRoles: mapTargetRoles(preference.targetRoles),
    locations: mapLocations(preference.locations),
    workTypes: preference.workTypes,
    salaryExpectation: {
      min: preference.salaryMin,
      max: preference.salaryMax,
      currency: preference.salaryCurrency,
      period: preference.salaryPeriod
    },
    emailNotificationsEnabled: preference.emailNotificationsEnabled,
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt
  };
}

function mapTargetRoles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapLocations(value: unknown): PreferenceLocation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const location = item as Record<string, unknown>;
    if (typeof location.province !== "string") {
      return [];
    }

    return [
      {
        province: location.province,
        city: typeof location.city === "string" ? location.city : null
      }
    ];
  });
}
