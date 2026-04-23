import { describe, expect, test } from "bun:test";

import { PrismaAiJobFitRepository } from "@/modules/ai-job-fit";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";
import { modelApiFixtures } from "../../fixtures/model-api";

describe("PrismaAiJobFitRepository", () => {
  test("loads user context and persists fit plus skill gap snapshots", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaAiJobFitRepository(context.prisma);
      const skill = await context.prisma.skill.create({
        data: {
          name: "TypeScript",
          slug: `typescript-${context.runId}`
        }
      });
      const user = await context.prisma.user.create({
        data: {
          email: `ai-job-fit-${context.runId}@example.test`,
          username: `ai_job_fit_${context.runId.replaceAll("-", "_")}`,
          displayName: "AI Job Fit User",
          phoneNumber: "+6281234567890",
          emailVerifiedAt: new Date("2026-04-23T00:00:00.000Z"),
          profile: {
            create: {
              careerStatus: "EARLY_CAREER",
              latestRole: "Backend Developer",
              summary: "Build APIs"
            }
          },
          userSkills: {
            create: {
              skillId: skill.id,
              level: "INTERMEDIATE"
            }
          },
          experiences: {
            create: {
              title: "Backend Intern",
              company: "Nusantara Tech",
              employmentType: "INTERNSHIP",
              description: "Built APIs",
              sortOrder: 0
            }
          },
          preference: {
            create: {
              careerStatus: "EARLY_CAREER",
              jobSeekingStatus: "IMMEDIATE",
              targetRoles: ["Backend Developer"],
              locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
              workTypes: ["REMOTE"],
              salaryCurrency: "IDR",
              salaryPeriod: "MONTHLY",
              emailNotificationsEnabled: true
            }
          }
        }
      });
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `ai-job-fit-glints-${context.runId}`,
          name: "AI Job Fit Source",
          baseUrl: "https://glints.example"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `ai-job-fit-company-${context.runId}`,
          name: "AI Job Fit Company"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `ai-job-fit-job-${context.runId}`,
          title: "Backend Developer",
          normalizedTitle: "backend developer",
          description: "Build APIs",
          requirementSummary: "TypeScript",
          workType: "REMOTE",
          employmentType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          locationDisplay: "Jakarta Selatan, DKI Jakarta",
          province: "DKI Jakarta",
          city: "Jakarta Selatan",
          salaryMin: 5_000_000,
          salaryMax: 10_000_000,
          salaryPeriod: "MONTHLY",
          sourceUrl: "https://glints.example/job",
          externalApplyUrl: "https://glints.example/apply",
          sourcePostedAt: new Date("2026-04-20T00:00:00.000Z"),
          lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
          status: "ACTIVE",
          requirements: {
            create: {
              type: "SKILL",
              value: "TypeScript",
              priority: "HIGH",
              sortOrder: 0
            }
          },
          jobSkills: {
            create: {
              skillId: skill.id
            }
          }
        }
      });

      const loadedContext = await repository.findUserContext(user.id);
      const loadedJob = await repository.findVisibleJob(job.id);

      await repository.createSnapshot({
        userId: user.id,
        jobId: job.id,
        payload: {
          requestId: "req_ai_job_fit_repository",
          inputVersion: "job-fit-v1",
          user: {
            careerStatus: "EARLY_CAREER",
            skills: [{ name: "TypeScript", level: "INTERMEDIATE" }],
            experience: [
              {
                title: "Backend Intern",
                company: "Nusantara Tech",
                employmentType: "INTERNSHIP",
                startDate: null,
                endDate: null,
                isCurrent: false,
                description: "Built APIs"
              }
            ]
          },
          preferences: {
            targetRoles: ["Backend Developer"],
            locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
            workTypes: ["REMOTE"],
            salaryExpectation: {
              min: 5_000_000,
              max: 10_000_000,
              currency: "IDR",
              period: "MONTHLY"
            }
          },
          job: {
            id: job.id,
            title: "Backend Developer",
            description: "Build APIs",
            requirements: [
              {
                type: "SKILL",
                value: "TypeScript",
                priority: "HIGH"
              }
            ],
            skills: ["TypeScript"],
            workType: "REMOTE",
            experienceLevel: "ENTRY_LEVEL",
            location: { province: "DKI Jakarta", city: "Jakarta Selatan" },
            salary: {
              min: 5_000_000,
              max: 10_000_000,
              currency: "IDR",
              period: "MONTHLY"
            }
          }
        },
        response: modelApiFixtures.validJobFitResponse
      });

      const fitResults = await context.prisma.fitScoreResult.findMany({
        where: { userId: user.id, jobListingId: job.id }
      });
      const gapResults = await context.prisma.skillGapResult.findMany({
        where: { userId: user.id, jobListingId: job.id }
      });

      expect(loadedContext).toMatchObject({
        userId: user.id,
        profile: { careerStatus: "EARLY_CAREER" },
        skills: [{ name: "TypeScript", level: "INTERMEDIATE" }],
        preference: {
          targetRoles: ["Backend Developer"],
          workTypes: ["REMOTE"]
        }
      });
      expect(loadedJob).toMatchObject({
        id: job.id,
        title: "Backend Developer",
        company: { name: "AI Job Fit Company" }
      });
      expect(fitResults).toHaveLength(1);
      expect(gapResults).toHaveLength(1);
      expect(fitResults[0]).toMatchObject({
        fitScore: 82,
        readinessLevel: "READY_WITH_MINOR_GAPS",
        recommendationDecision: "APPLY_NOW"
      });
    } finally {
      await context.cleanup();
    }
  });
});
