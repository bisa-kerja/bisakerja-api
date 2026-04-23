import { describe, expect, test } from "bun:test";

import { PrismaBookmarksRepository } from "@/modules/bookmarks";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaBookmarksRepository", () => {
  test("creates, lists, filters, and deletes bookmarks by current user", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaBookmarksRepository(context.prisma);
      const user = await context.prisma.user.create({
        data: {
          email: `bookmark-user-${context.runId}@example.test`,
          username: `bookmark-user-${context.runId}`,
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });
      const otherUser = await context.prisma.user.create({
        data: {
          email: `bookmark-other-${context.runId}@example.test`,
          username: `bookmark-other-${context.runId}`,
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `bookmark-glints-${context.runId}`,
          name: "Glints Bookmark Test",
          baseUrl: "https://glints.example"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `bookmark-company-${context.runId}`,
          name: "Bookmark Repository Company"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `bookmark-job-${context.runId}`,
          title: "Backend Bookmark Developer",
          normalizedTitle: "backend bookmark developer",
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
          status: "ACTIVE"
        }
      });

      await repository.createForUser(user.id, job.id);
      await repository.createForUser(otherUser.id, job.id);

      const list = await repository.listForUser(user.id, {
        page: 1,
        limit: 20,
        keyword: "backend",
        sort: "created_desc"
      });
      const visibleJob = await repository.findVisibleJobById(job.id);
      const owned = await repository.findByUserAndJob(user.id, job.id);
      const deleted = await repository.deleteByUserAndJob(user.id, job.id);
      const afterDelete = await repository.findByUserAndJob(user.id, job.id);

      expect(list.total).toBe(1);
      expect(list.items[0]).toMatchObject({
        userId: user.id,
        jobListingId: job.id,
        job: {
          title: "Backend Bookmark Developer",
          sourcePlatform: { slug: sourcePlatform.slug },
          company: { name: "Bookmark Repository Company" }
        }
      });
      expect(JSON.stringify(list.items[0])).not.toContain("externalJobId");
      expect(visibleJob).toMatchObject({ id: job.id });
      expect(owned).toMatchObject({ userId: user.id, jobListingId: job.id });
      expect(deleted).toBe(true);
      expect(afterDelete).toBeNull();
    } finally {
      await context.cleanup();
    }
  });
});
