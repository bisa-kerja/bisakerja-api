import { describe, expect, test } from "bun:test";

import { PrismaJobsRepository } from "@/modules/jobs";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaJobsRepository", () => {
  test("lists and reads normalized jobs without exposing scraper payloads", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaJobsRepository(context.prisma);
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `glints-${context.runId}`,
          name: "Glints Test",
          baseUrl: "https://glints.example"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `jobs-company-${context.runId}`,
          name: "Repository Jobs Company",
          websiteUrl: "https://example.test/company"
        }
      });
      const skill = await context.prisma.skill.create({
        data: {
          slug: `typescript-${context.runId}`,
          name: "TypeScript",
          category: "Programming"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `repo-job-${context.runId}`,
          title: "Backend Developer",
          normalizedTitle: "backend developer",
          category: "Engineering",
          description: "Build and maintain backend APIs.",
          requirementSummary: "TypeScript and PostgreSQL.",
          workType: "REMOTE",
          employmentType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          locationDisplay: "Jakarta Selatan, DKI Jakarta",
          province: "DKI Jakarta",
          city: "Jakarta Selatan",
          salaryMin: 5_000_000,
          salaryMax: 10_000_000,
          salaryPeriod: "MONTHLY",
          salaryDisplay: "Rp5.000.000 - Rp10.000.000 / bulan",
          sourceUrl: "https://glints.example/job",
          externalApplyUrl: "https://glints.example/apply",
          sourcePostedAt: new Date("2026-04-20T00:00:00.000Z"),
          lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
          status: "ACTIVE",
          requirements: {
            create: [
              {
                type: "SKILL",
                value: "TypeScript",
                priority: "HIGH",
                sortOrder: 0
              }
            ]
          },
          jobSkills: {
            create: [{ skillId: skill.id }]
          }
        }
      });

      await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `hidden-job-${context.runId}`,
          title: "Hidden Backend Developer",
          sourceUrl: "https://glints.example/hidden",
          externalApplyUrl: "https://glints.example/hidden/apply",
          lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
          status: "HIDDEN"
        }
      });

      const list = await repository.listJobs({
        page: 1,
        limit: 20,
        keyword: "backend",
        sourcePlatform: sourcePlatform.slug,
        skill: "TypeScript",
        salaryMin: 8_000_000,
        sort: "relevance"
      });
      const detail = await repository.findVisibleById(job.id);

      expect(list.total).toBe(1);
      expect(list.items[0]).toMatchObject({
        id: job.id,
        title: "Backend Developer",
        company: { name: "Repository Jobs Company" },
        sourcePlatform: { slug: sourcePlatform.slug },
        requirements: [{ type: "SKILL", value: "TypeScript" }],
        skills: [{ name: "TypeScript" }]
      });
      expect(detail).toMatchObject({
        id: job.id,
        externalApplyUrl: "https://glints.example/apply"
      });
      expect(JSON.stringify(detail)).not.toContain("externalJobId");
    } finally {
      await context.cleanup();
    }
  });
});
