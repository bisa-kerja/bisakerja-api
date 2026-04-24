import { describe, expect, test } from "bun:test";

import { PrismaPreferencesRepository } from "@/modules/preferences/preferences.repository";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaPreferencesRepository", () => {
  test("upserts one active preference set per user and preserves ownership", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaPreferencesRepository(context.prisma);
      const user = await context.prisma.user.create({
        data: {
          email: `preferences-${context.runId}@example.test`,
          username: `preferences_${context.runId.replaceAll("-", "_")}`,
          phoneNumber: "+6281234567890",
          displayName: "Salman Dev",
          emailVerifiedAt: new Date("2026-04-23T00:00:00.000Z")
        }
      });
      const otherUser = await context.prisma.user.create({
        data: {
          email: `preferences-other-${context.runId}@example.test`,
          username: `preferences_other_${context.runId.replaceAll("-", "_")}`
        }
      });

      const missing = await repository.findByUserId(user.id);
      expect(missing).toBeNull();

      const created = await repository.upsertForUser(user.id, {
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
      });

      const updated = await repository.upsertForUser(user.id, {
        careerStatus: "EARLY_CAREER",
        jobSeekingStatus: "ONE_MONTH",
        targetRoles: ["Frontend Developer"],
        locations: [{ province: "Jawa Barat", city: "Bandung" }],
        workTypes: ["HYBRID"],
        salaryExpectation: {
          min: null,
          max: 12_000_000,
          currency: "IDR",
          period: "MONTHLY"
        },
        emailNotificationsEnabled: false
      });

      const otherPreference = await repository.findByUserId(otherUser.id);
      const activeCount = await context.prisma.userPreference.count({
        where: { userId: user.id }
      });

      expect(updated.id).toBe(created.id);
      expect(activeCount).toBe(1);
      expect(updated).toMatchObject({
        userId: user.id,
        careerStatus: "EARLY_CAREER",
        targetRoles: ["Frontend Developer"],
        locations: [{ province: "Jawa Barat", city: "Bandung" }],
        workTypes: ["HYBRID"],
        salaryExpectation: {
          min: null,
          max: 12_000_000,
          currency: "IDR",
          period: "MONTHLY"
        },
        emailNotificationsEnabled: false
      });
      expect(otherPreference).toBeNull();

      const state = await repository.findUserOnboardingState(user.id);
      expect(state).toMatchObject({
        emailVerified: true,
        displayName: "Salman Dev",
        phoneNumber: "+6281234567890",
        onboardingStatus: "PENDING"
      });

      await repository.updateUserOnboardingStatus(user.id, "COMPLETED");
      const synced = await repository.findUserOnboardingState(user.id);
      expect(synced?.onboardingStatus).toBe("COMPLETED");
    } finally {
      await context.cleanup();
    }
  });
});
