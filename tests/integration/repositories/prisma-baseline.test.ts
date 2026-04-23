import { describe, expect, test } from "bun:test";

import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

async function expectToReject(action: () => Promise<unknown>) {
  let rejected = false;

  try {
    await action();
  } catch {
    rejected = true;
  }

  expect(rejected).toBe(true);
}

describe("Prisma database baseline", () => {
  test("creates and reads normalized job catalog records", async () => {
    const context = await createRepositoryTestContext();
    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `glints-${context.runId}`,
          name: "Glints Test"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `company-${context.runId}`,
          name: "Repository Test Company"
        }
      });
      const skill = await context.prisma.skill.create({
        data: {
          slug: `typescript-${context.runId}`,
          name: "TypeScript"
        }
      });

      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `job-${context.runId}`,
          title: "Backend Developer",
          normalizedTitle: "backend developer",
          description: "Build backend APIs.",
          workType: "REMOTE",
          employmentType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          locationDisplay: "Jakarta Selatan, DKI Jakarta",
          province: "DKI Jakarta",
          city: "Jakarta Selatan",
          salaryMin: 5000000,
          salaryMax: 10000000,
          salaryPeriod: "MONTHLY",
          sourceUrl: "https://example.test/job",
          externalApplyUrl: "https://example.test/job/apply",
          lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
          requirements: {
            create: [
              {
                type: "SKILL",
                value: "TypeScript",
                priority: "HIGH"
              }
            ]
          },
          jobSkills: {
            create: [
              {
                skillId: skill.id,
                confidence: "1.0000"
              }
            ]
          }
        },
        include: {
          sourcePlatform: true,
          company: true,
          requirements: true,
          jobSkills: { include: { skill: true } }
        }
      });

      expect(job.sourcePlatform.slug).toBe(`glints-${context.runId}`);
      expect(job.company.name).toBe("Repository Test Company");
      expect(job.requirements[0]?.value).toBe("TypeScript");
      expect(job.jobSkills[0]?.skill.slug).toBe(`typescript-${context.runId}`);
    } finally {
      await context.cleanup();
    }
  });

  test("enforces user-owned uniqueness constraints", async () => {
    const context = await createRepositoryTestContext();
    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const user = await context.prisma.user.create({
        data: {
          email: `owner-${context.runId}@example.test`,
          username: `owner-${context.runId}`,
          displayName: "Owner User",
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z"),
          authCredential: {
            create: {
              passwordHash: "hashed-password-for-test-only",
              passwordHashAlgorithm: "test"
            }
          }
        }
      });
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `jobstreet-${context.runId}`,
          name: "Jobstreet Test"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `tracker-company-${context.runId}`,
          name: "Tracker Company"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `tracked-${context.runId}`,
          title: "Junior Developer",
          sourceUrl: "https://example.test/tracked",
          externalApplyUrl: "https://example.test/tracked/apply",
          lastSeenAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });

      await context.prisma.userPreference.create({
        data: {
          userId: user.id,
          careerStatus: "FRESH_GRADUATE",
          jobSeekingStatus: "IMMEDIATE",
          targetRoles: ["Backend Developer"],
          locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
          workTypes: ["REMOTE"],
          emailNotificationsEnabled: true
        }
      });
      await expectToReject(() =>
        context.prisma.userPreference.create({
          data: {
            userId: user.id,
            careerStatus: "EARLY_CAREER",
            jobSeekingStatus: "ONE_MONTH",
            targetRoles: ["Full Stack Developer"],
            locations: [{ province: "Jawa Barat", city: "Bandung" }],
            workTypes: ["HYBRID"],
            emailNotificationsEnabled: false
          }
        })
      );

      await context.prisma.bookmark.create({
        data: {
          userId: user.id,
          jobListingId: job.id
        }
      });
      await expectToReject(() =>
        context.prisma.bookmark.create({
          data: {
            userId: user.id,
            jobListingId: job.id
          }
        })
      );

      const application = await context.prisma.applicationRecord.create({
        data: {
          userId: user.id,
          jobListingId: job.id,
          status: "APPLIED",
          history: {
            create: {
              userId: user.id,
              toStatus: "APPLIED",
              notes: "Initial tracker row."
            }
          }
        },
        include: { history: true }
      });

      expect(application.history).toHaveLength(1);
      await expectToReject(() =>
        context.prisma.applicationRecord.create({
          data: {
            userId: user.id,
            jobListingId: job.id,
            status: "APPLIED"
          }
        })
      );
    } finally {
      await context.cleanup();
    }
  });
});
