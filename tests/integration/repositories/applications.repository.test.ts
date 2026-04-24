import { describe, expect, test } from "bun:test";

import { PrismaApplicationsRepository } from "@/modules/applications/applications.repository";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaApplicationsRepository", () => {
  test("creates, lists, updates, and records application history by current user", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaApplicationsRepository(context.prisma);
      const user = await context.prisma.user.create({
        data: {
          email: `application-user-${context.runId}@example.test`,
          username: `application-user-${context.runId}`,
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });
      const otherUser = await context.prisma.user.create({
        data: {
          email: `application-other-${context.runId}@example.test`,
          username: `application-other-${context.runId}`,
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `application-glints-${context.runId}`,
          name: "Glints Application Test",
          baseUrl: "https://glints.example"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `application-company-${context.runId}`,
          name: "Application Repository Company"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `application-job-${context.runId}`,
          title: "Backend Application Developer",
          normalizedTitle: "backend application developer",
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

      const created = await repository.createForUser(user.id, {
        jobId: job.id,
        status: "APPLIED",
        source: "MANUAL",
        notes: "Applied from repository test"
      });
      await repository.createForUser(otherUser.id, {
        jobId: job.id,
        status: "APPLIED",
        source: "MANUAL"
      });

      const list = await repository.listForUser(user.id, {
        page: 1,
        limit: 20,
        keyword: "backend",
        status: "APPLIED",
        sort: "updated_desc"
      });
      const owned = await repository.findByIdForUser(user.id, created.id);
      const notOwned = await repository.findByIdForUser(
        otherUser.id,
        created.id
      );
      const updated = await repository.updateForUser(user.id, created.id, {
        notes: null,
        source: "EXTERNAL_APPLY_CLICK"
      });
      const statusUpdated = await repository.updateStatusForUser(
        user.id,
        created.id,
        { status: "INTERVIEW", notes: "Interview scheduled" },
        "APPLIED"
      );
      const history = await repository.listHistory(created.id);

      expect(list.total).toBe(1);
      expect(list.items[0]).toMatchObject({
        userId: user.id,
        jobListingId: job.id,
        job: {
          title: "Backend Application Developer",
          sourcePlatform: { slug: sourcePlatform.slug },
          company: { name: "Application Repository Company" }
        }
      });
      expect(JSON.stringify(list.items[0])).not.toContain("externalJobId");
      expect(owned).toMatchObject({ userId: user.id, jobListingId: job.id });
      expect(notOwned).toBeNull();
      expect(updated).toMatchObject({
        notes: null,
        source: "EXTERNAL_APPLY_CLICK"
      });
      expect(statusUpdated).toMatchObject({
        status: "INTERVIEW",
        notes: "Interview scheduled"
      });
      expect(history).toHaveLength(2);
      expect(history.at(-1)).toMatchObject({
        fromStatus: "APPLIED",
        toStatus: "INTERVIEW"
      });
    } finally {
      await context.cleanup();
    }
  });
});
