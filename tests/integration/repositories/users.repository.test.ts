import { describe, expect, test } from "bun:test";

import { PrismaUsersRepository } from "@/modules/users/users.repository";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaUsersRepository", () => {
  test("reads and replaces current-user profile data with ownership isolation", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaUsersRepository(context.prisma);
      const user = await context.prisma.user.create({
        data: {
          email: `users-${context.runId}@example.test`,
          username: `users_${context.runId.replaceAll("-", "_")}`,
          phoneNumber: null,
          displayName: null
        }
      });
      const otherUser = await context.prisma.user.create({
        data: {
          email: `users-other-${context.runId}@example.test`,
          username: `users_other_${context.runId.replaceAll("-", "_")}`,
          phoneNumber: "+6281111111111",
          displayName: "Other User"
        }
      });

      const initial = await repository.findCurrentUserById(user.id);

      expect(initial).toMatchObject({
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: false,
        phoneNumber: null,
        displayName: null,
        onboardingStatus: "PENDING",
        hasPreference: false,
        profile: null,
        skills: [],
        experience: [],
        education: []
      });

      await repository.updateCurrentUser(user.id, {
        username: `profile_${context.runId.replaceAll("-", "_")}`,
        phoneNumber: "+6281234567890",
        displayName: "Salman Dev"
      });
      await repository.upsertProfilePhoto(user.id, {
        storageKey: `profile-photos/${user.id}/avatar.webp`,
        url: "https://cdn.example.com/profile-photos/user/avatar.webp",
        mimeType: "image/webp",
        sizeBytes: 4096
      });
      await repository.replaceSkills(user.id, [
        {
          name: "TypeScript",
          slug: `typescript-${context.runId}`,
          level: "ADVANCED"
        },
        {
          name: "PostgreSQL",
          slug: `postgresql-${context.runId}`,
          level: "BASIC"
        }
      ]);
      await repository.replaceExperience(user.id, [
        {
          title: "Backend Developer Intern",
          company: "Example Tech",
          employmentType: "INTERNSHIP",
          startDate: new Date("2025-01-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
          isCurrent: false,
          description: "Built REST APIs with TypeScript."
        }
      ]);
      await repository.replaceEducation(user.id, [
        {
          institution: "Universitas Contoh",
          degree: "Bachelor",
          fieldOfStudy: "Informatics",
          startYear: 2021,
          endYear: 2025
        }
      ]);
      await repository.updateOnboardingStatus(user.id, "IN_PROGRESS");

      const updated = await repository.findCurrentUserById(user.id);
      const isolated = await repository.findCurrentUserById(otherUser.id);

      expect(updated).toMatchObject({
        id: user.id,
        username: `profile_${context.runId.replaceAll("-", "_")}`,
        phoneNumber: "+6281234567890",
        displayName: "Salman Dev",
        onboardingStatus: "IN_PROGRESS",
        profile: {
          profilePhotoStorageKey: `profile-photos/${user.id}/avatar.webp`,
          profilePhotoUrl:
            "https://cdn.example.com/profile-photos/user/avatar.webp",
          profilePhotoMimeType: "image/webp",
          profilePhotoSizeBytes: 4096
        },
        skills: [
          { name: "TypeScript", level: "ADVANCED" },
          { name: "PostgreSQL", level: "BASIC" }
        ],
        experience: [
          {
            title: "Backend Developer Intern",
            company: "Example Tech",
            employmentType: "INTERNSHIP",
            isCurrent: false,
            description: "Built REST APIs with TypeScript."
          }
        ],
        education: [
          {
            institution: "Universitas Contoh",
            degree: "Bachelor",
            fieldOfStudy: "Informatics",
            startYear: 2021,
            endYear: 2025
          }
        ]
      });
      expect(updated?.experience[0]?.startDate?.toISOString()).toBe(
        "2025-01-01T00:00:00.000Z"
      );
      expect(updated?.experience[0]?.endDate?.toISOString()).toBe(
        "2025-06-30T00:00:00.000Z"
      );
      expect(isolated?.skills).toEqual([]);
      expect(isolated?.experience).toEqual([]);
      expect(isolated?.education).toEqual([]);
    } finally {
      await context.cleanup();
    }
  });

  test("reports preference presence for onboarding status calculation", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaUsersRepository(context.prisma);
      const user = await context.prisma.user.create({
        data: {
          email: `users-pref-${context.runId}@example.test`,
          username: `users_pref_${context.runId.replaceAll("-", "_")}`,
          phoneNumber: "+6281234567890",
          displayName: "Salman Dev",
          emailVerifiedAt: new Date("2026-04-23T00:00:00.000Z"),
          preference: {
            create: {
              careerStatus: "FRESH_GRADUATE",
              jobSeekingStatus: "IMMEDIATE",
              targetRoles: ["Backend Developer"],
              locations: [{ province: "DKI Jakarta", city: "Jakarta" }],
              workTypes: ["REMOTE"],
              salaryMin: 5_000_000,
              salaryMax: 10_000_000,
              emailNotificationsEnabled: true
            }
          }
        }
      });

      const current = await repository.findCurrentUserById(user.id);

      expect(current).toMatchObject({
        id: user.id,
        emailVerified: true,
        hasPreference: true
      });
    } finally {
      await context.cleanup();
    }
  });
});
