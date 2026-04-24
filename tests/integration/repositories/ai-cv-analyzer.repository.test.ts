import { describe, expect, test } from "bun:test";

import { PrismaAiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaAiCvAnalyzerRepository", () => {
  test("stores cv metadata, snapshots, bookmark ownership, and expired cleanup candidates", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaAiCvAnalyzerRepository(context.prisma);
      const user = await context.prisma.user.create({
        data: {
          email: `cv-user-${context.runId}@example.test`,
          username: `cv-user-${context.runId}`,
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });
      const sourcePlatform = await context.prisma.sourcePlatform.create({
        data: {
          slug: `cv-glints-${context.runId}`,
          name: "Glints CV Test",
          baseUrl: "https://glints.example"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `cv-company-${context.runId}`,
          name: "CV Analyzer Company"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `cv-job-${context.runId}`,
          title: "Backend CV Developer",
          normalizedTitle: "backend cv developer",
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

      await context.prisma.bookmark.create({
        data: {
          userId: user.id,
          jobListingId: job.id
        }
      });

      const metadata = await repository.createCvFileMetadata({
        id: `cv-file-${context.runId}`,
        userId: user.id,
        originalFileName: "cv.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageDriver: "LOCAL",
        storageKey: `cv/${user.id}/cv-file-${context.runId}.pdf`,
        expiresAt: new Date("2026-04-24T00:00:00.000Z")
      });

      await repository.createSnapshot({
        userId: user.id,
        jobId: job.id,
        cvFileMetadataId: metadata.id,
        language: "ID",
        inputMode: "UPLOAD",
        compareSource: "BOOKMARK",
        payload: {
          requestId: "req_cv_repo",
          inputVersion: "cv-analyzer-v1",
          language: "ID",
          inputMode: "UPLOAD",
          compareSource: "BOOKMARK",
          cv: {
            fileId: metadata.id,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.sizeBytes,
            storageKey: metadata.storageKey
          },
          job: {
            id: job.id,
            title: job.title,
            description: job.description,
            requirements: [],
            skills: [],
            experienceLevel: job.experienceLevel
          }
        },
        response: {
          overallImpression: {
            score: 80,
            summary: "Relevant for the role."
          },
          jobFitAlignment: {
            score: 75,
            summary: "Core backend skills are visible.",
            matchedSignals: ["TypeScript"],
            missingSignals: ["Docker"]
          },
          atsFriendliness: {
            score: 70,
            issues: ["Section headings are inconsistent."]
          },
          keywordOptimization: {
            recommendedKeywords: ["Docker"],
            reason: "Appears in the job requirements."
          },
          experienceQuantification: {
            score: 60,
            suggestions: ["Add measurable API impact."]
          },
          actionableImprovements: ["Add a stronger backend summary."],
          model: {
            name: "fixture-cv-analyzer-model",
            version: "test-2026-01"
          },
          analyzedAt: "2026-04-23T00:00:00.000Z"
        }
      });

      const visibleJob = await repository.findVisibleJob(job.id);
      const hasBookmark = await repository.hasOwnedBookmarkForJob(
        user.id,
        job.id
      );
      const otherUser = await context.prisma.user.create({
        data: {
          email: `cv-other-${context.runId}@example.test`,
          username: `cv-other-${context.runId}`,
          emailVerifiedAt: new Date("2026-04-22T00:00:00.000Z")
        }
      });
      const otherUserHasBookmark = await repository.hasOwnedBookmarkForJob(
        otherUser.id,
        job.id
      );
      const expiredBeforeDelete = await repository.findExpiredActiveCvFiles(
        new Date("2026-04-25T00:00:00.000Z")
      );
      const markedDeleted = await repository.markCvFilesDeleted(
        [metadata.id],
        new Date("2026-04-25T00:00:00.000Z")
      );
      const expiredAfterDelete = await repository.findExpiredActiveCvFiles(
        new Date("2026-04-25T00:00:00.000Z")
      );
      const snapshots = await context.prisma.cvAnalysisResult.findMany({
        where: {
          userId: user.id
        }
      });

      expect(visibleJob).toMatchObject({ id: job.id, title: job.title });
      expect(hasBookmark).toBe(true);
      expect(otherUserHasBookmark).toBe(false);
      expect(expiredBeforeDelete).toEqual([
        {
          id: metadata.id,
          storageKey: metadata.storageKey
        }
      ]);
      expect(markedDeleted).toBe(1);
      expect(expiredAfterDelete).toEqual([]);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        cvFileMetadataId: metadata.id,
        compareSource: "BOOKMARK"
      });
    } finally {
      await context.cleanup();
    }
  });
});
