import { describe, expect, test } from "bun:test";

import { PrismaAiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.repository";
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
        expiresAt: new Date("2026-04-24T00:00:00.000Z"),
        isActive: true
      });
      const replacementMetadata = await repository.createCvFileMetadata({
        id: `cv-file-active-${context.runId}`,
        userId: user.id,
        originalFileName: "cv-active.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        storageDriver: "LOCAL",
        storageKey: `cv/${user.id}/cv-file-active-${context.runId}.pdf`,
        expiresAt: new Date("2026-04-24T00:00:00.000Z"),
        isActive: true
      });

      await repository.createSnapshot({
        userId: user.id,
        jobRoles: ["Backend Developer"],
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
          jobRoles: ["Backend Developer"],
          rankingPolicy: {
            backendOwnsHydration: true,
            requireCandidateJobIds: true,
            deduplicateByJobId: true,
            maxRecommendations: 1
          },
          jobCandidates: []
        },
        modelCoreResponse: {
          schemaVersion: "model-core-cv-analysis-v1",
          parsedCv: {
            status: "parsed",
            pageCount: 1,
            textLength: 500,
            detectedSections: ["Work Experience"]
          },
          jobFitAlignment: {
            score: 75,
            matchedSignals: ["Backend"],
            missingSignals: [],
            matchedSkills: ["TypeScript"],
            missingSkills: [],
            evidence: []
          },
          atsFriendliness: {
            score: 70,
            detectedIssues: [],
            parseQuality: "medium",
            evidence: []
          },
          overallImpression: {
            score: 73,
            evidence: ["Relevant for the role"]
          },
          candidateReranking: {
            recommendations: []
          },
          model: {
            name: "fixture-cv-analyzer-model",
            version: "test-2026-01"
          },
          createdAt: "2026-04-23T00:00:00.000Z"
        },
        candidates: [],
        requestId: "req_cv_repo",
        response: {
          schemaVersion: "cv-analysis-v2",
          jobFitAlignment: {
            score: 75,
            summary: "Core backend skills are visible."
          },
          atsFriendliness: {
            score: 70,
            summary:
              "Readable structure, but some ATS keyword coverage is still weak."
          },
          overallImpression: "Relevant for the role.",
          topActionables: ["Add a stronger backend summary."],
          sectionReviews: [
            {
              sectionName: "Work Experience",
              analysis: "Experience is relevant but impact is not measured.",
              actionPoints: ["Add measurable API impact."],
              whyItsImportantForYou:
                "Measured impact makes contribution easier to evaluate."
            }
          ],
          jobRecommendations: [
            {
              jobId: job.id,
              title: job.title,
              companyName: "CV Analyzer Company",
              matchScore: 80,
              reason: "Role matches backend signals.",
              nextStep: "Improve deployment evidence."
            }
          ],
          model: {
            name: "fixture-cv-analyzer-model",
            version: "test-2026-01"
          },
          analyzedAt: "2026-04-23T00:00:00.000Z"
        }
      });

      const activeMetadata = await repository.findActiveCvFileMetadata(
        user.id,
        new Date("2026-04-23T00:00:00.000Z")
      );
      const explicitMetadata = await repository.findCvFileMetadataById(
        replacementMetadata.id,
        new Date("2026-04-23T00:00:00.000Z")
      );
      const expiredBeforeDelete = await repository.findExpiredActiveCvFiles(
        new Date("2026-04-25T00:00:00.000Z")
      );
      const markedDeleted = await repository.markCvFilesDeleted(
        [metadata.id, replacementMetadata.id],
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

      expect(activeMetadata).toMatchObject({
        id: replacementMetadata.id,
        isActive: true
      });
      expect(explicitMetadata).toMatchObject({
        id: replacementMetadata.id,
        userId: user.id
      });
      expect(expiredBeforeDelete).toEqual([
        {
          id: metadata.id,
          storageKey: metadata.storageKey
        },
        {
          id: replacementMetadata.id,
          storageKey: replacementMetadata.storageKey
        }
      ]);
      expect(markedDeleted).toBe(2);
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
