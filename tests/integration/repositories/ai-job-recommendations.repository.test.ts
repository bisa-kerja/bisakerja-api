import { describe, expect, test } from "bun:test";

import { PrismaAiJobRecommendationsRepository } from "@/modules/ai-job-recommendations/ai-job-recommendations.repository";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaAiJobRecommendationsRepository", () => {
  test("resolves cv analysis, candidate jobs, and persists recommendation run", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaAiJobRecommendationsRepository(
        context.prisma
      );
      const skill = await context.prisma.skill.create({
        data: {
          name: "TypeScript",
          slug: `typescript-${context.runId}`
        }
      });
      const user = await context.prisma.user.create({
        data: {
          email: `ai-job-recommend-${context.runId}@example.test`,
          username: `ai_job_recommend_${context.runId.replaceAll("-", "_")}`,
          displayName: "AI Job Recommend User",
          phoneNumber: "+6281234567890",
          emailVerifiedAt: new Date("2026-05-18T00:00:00.000Z"),
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
          slug: `ai-job-recommend-source-${context.runId}`,
          name: "AI Job Recommend Source",
          baseUrl: "https://example.test"
        }
      });
      const company = await context.prisma.company.create({
        data: {
          slug: `ai-job-recommend-company-${context.runId}`,
          name: "AI Job Recommend Company"
        }
      });
      const job = await context.prisma.jobListing.create({
        data: {
          sourcePlatformId: sourcePlatform.id,
          companyId: company.id,
          externalJobId: `ai-job-recommend-job-${context.runId}`,
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
          sourceUrl: "https://example.test/job",
          externalApplyUrl: "https://example.test/apply",
          sourcePostedAt: new Date("2026-05-10T00:00:00.000Z"),
          lastSeenAt: new Date("2026-05-18T00:00:00.000Z"),
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
      const cvFile = await context.prisma.cvFileMetadata.create({
        data: {
          userId: user.id,
          originalFileName: "resume.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          storageDriver: "LOCAL",
          storageKey: `cv/${user.id}/resume.pdf`,
          isActive: true,
          uploadedAt: new Date("2026-05-17T00:00:00.000Z"),
          expiresAt: new Date("2026-05-19T00:00:00.000Z")
        }
      });
      const cvAnalysisData: Parameters<
        typeof context.prisma.cvAnalysisResult.create
      >[0]["data"] = {
        userId: user.id,
        jobListingId: job.id,
        cvFileMetadataId: cvFile.id,
        language: "ID",
        inputMode: "REFERENCE",
        compareSource: "JOB_SEARCH",
        schemaVersion: "cv-analysis-v2",
        overallImpression: "Relevan untuk backend role",
        jobFitAlignment: {
          score: 80,
          summary: "Good fit",
          matchedSignals: ["TypeScript"],
          missingSignals: ["Docker"]
        },
        atsFriendliness: {
          score: 74,
          summary: "Struktur cukup rapi tetapi keyword deployment masih lemah"
        },
        topActionables: ["Tambah pengalaman deploy"],
        sectionReviews: [
          {
            sectionName: "Relevant Skills",
            analysis: "Relevant skills are present, but not grouped clearly.",
            actionPoints: ["Kelompokkan skill backend dan deployment."],
            whyItsImportantForYou:
              "Keyword teknis yang jelas membantu screening awal."
          }
        ],
        modelName: "fixture-cv-model",
        modelVersion: "test-2026-01",
        analyzedAt: new Date("2026-05-18T08:00:00.000Z")
      };
      const cvAnalysis = await context.prisma.cvAnalysisResult.create({
        data: cvAnalysisData
      });

      const resolvedCv = await repository.findCvAnalysisResultByIdForUser(
        user.id,
        cvAnalysis.id
      );
      expect(resolvedCv).not.toBeNull();
      if (!resolvedCv) {
        throw new Error("Expected CV analysis result to be resolved");
      }
      const candidates = await repository.findCandidateJobsForRecommendations({
        userId: user.id,
        cvAnalysisResult: resolvedCv,
        filters: {
          workType: "REMOTE",
          excludeAppliedJobs: true,
          includeBookmarkedStatus: true
        },
        limit: 10
      });
      const run = await repository.createRecommendationRunSnapshot({
        userId: user.id,
        cvAnalysisResultId: cvAnalysis.id,
        idempotencyKey: `idem-${context.runId}`,
        requestedLimit: 5,
        candidateCount: candidates.length,
        recommendationCount: 1,
        modelName: "fixture-job-recommend-model",
        modelVersion: "test-2026-01",
        filtersSnapshot: {
          workType: "REMOTE",
          excludeAppliedJobs: true,
          includeBookmarkedStatus: true
        },
        inputSummary: {
          requestId: "req_repo_recommend",
          inputVersion: "job-recommendations-v1",
          talentProfile: {
            targetRole: "Backend Developer",
            seniorityLevel: "ENTRY_LEVEL",
            hardSkills: ["TypeScript"],
            softSkills: [],
            domainSignals: ["Engineering"],
            toolsAndTechnologies: ["REST API"],
            educationSignals: [],
            experienceYearsEstimate: null,
            locationPreferences: [
              { province: "DKI Jakarta", city: "Jakarta Selatan" }
            ],
            workTypePreferences: ["REMOTE"],
            salaryExpectation: {
              min: 5000000,
              max: 10000000,
              currency: "IDR",
              period: "MONTHLY"
            },
            redFlags: ["Docker"]
          },
          rankingPolicy: {
            maxRecommendations: 5,
            requireCandidateJobIds: true,
            deduplicateByJobId: true
          },
          jobCandidates: [
            {
              jobId: job.id,
              title: job.title,
              companyName: company.name,
              location: {
                display: job.locationDisplay,
                province: job.province,
                city: job.city
              },
              workType: job.workType,
              experienceLevel: job.experienceLevel,
              descriptionSummary: job.description,
              requiredSkills: ["TypeScript"],
              postedAt: job.sourcePostedAt?.toISOString() ?? null,
              sourceUpdatedAt: null
            }
          ]
        },
        createdAt: new Date("2026-05-18T10:00:00.000Z"),
        items: [
          {
            jobListingId: job.id,
            rank: 1,
            matchScore: 86,
            matchLevel: "STRONG",
            reasons: ["Kecocokan skill backend utama sudah kuat."],
            matchedSkills: ["TypeScript"],
            missingSkills: ["Docker"],
            nextSteps: ["Add deployment experience to the CV."]
          }
        ]
      });

      expect(resolvedCv).toMatchObject({
        id: cvAnalysis.id,
        userId: user.id,
        job: { id: job.id }
      });
      expect(candidates).toHaveLength(1);
      expect(run.items).toHaveLength(1);
      expect(run.items[0]).toMatchObject({
        rank: 1,
        matchScore: 86,
        matchLevel: "STRONG",
        job: { id: job.id }
      });
    } finally {
      await context.cleanup();
    }
  });
});
