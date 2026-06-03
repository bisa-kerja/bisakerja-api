import { describe, expect, test } from "bun:test";

import {
  AiJobRecommendationsService,
  buildRecommendationPayload,
  buildTalentProfile
} from "@/modules/ai-job-recommendations";
import { aiJobRecommendationsErrorCodes } from "@/modules/ai-job-recommendations/ai-job-recommendations.constants";
import type {
  AiJobRecommendationsRepository,
  CvAnalysisResolverRecord,
  JobRecommendationRunDetailRecord,
  JobRecommendationRunSnapshotInput,
  RecommendationCandidateRecord
} from "@/modules/ai-job-recommendations";
import type { JobRecord } from "@/modules/jobs";
import type { PreferenceContext } from "@/modules/preferences/preferences.types";
import { modelApiFixtures } from "../../fixtures/model-api";

describe("AiJobRecommendationsService", () => {
  test("builds payload with bounded candidates and talent profile", () => {
    const context = createContext();
    const payload = buildRecommendationPayload({
      requestId: "req_recommend_payload",
      context,
      limit: 10
    });

    expect(payload.inputVersion).toBe("job-recommendations-v1");
    expect(payload.jobCandidates.length).toBe(2);
    expect(payload.talentProfile.targetRole).toBe("Backend Developer");
    expect(payload.talentProfile.hardSkills).toContain("TypeScript");
  });

  test("maps talent profile from cv analysis and preferences", () => {
    const profile = buildTalentProfile({
      cvAnalysisResult: createContext().cvAnalysisResult,
      preference: createContext().preference
    });

    expect(profile).toMatchObject({
      targetRole: "Backend Developer",
      seniorityLevel: "ENTRY_LEVEL",
      locationPreferences: [
        { province: "DKI Jakarta", city: "Jakarta Selatan" }
      ],
      workTypePreferences: ["REMOTE"]
    });
  });

  test("generates recommendations and stores snapshot", async () => {
    const repository = new InMemoryRecommendationsRepository();
    const service = new AiJobRecommendationsService(repository, {
      modelApiClient: {
        analyzeJobFit: () => Promise.reject(new Error("Not used")),
        analyzeCv: () => Promise.reject(new Error("Not used")),
        recommendJobs: () =>
          Promise.resolve(modelApiFixtures.validJobRecommendationsResponse)
      },
      now: () => new Date("2026-05-18T10:00:00.000Z")
    });

    const result = await service.generateRecommendations(
      "user-1",
      "req_recommend_success",
      {
        cvAnalysisResultId: createContext().cvAnalysisResult.id,
        limit: 2,
        filters: {
          includeBookmarkedStatus: true,
          excludeAppliedJobs: true
        },
        idempotencyKey: "idem-1"
      }
    );

    expect(result.recommendationRun.recommendationCount).toBe(2);
    expect(result.recommendations[0]?.job.id).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(repository.snapshots).toHaveLength(1);
  });

  test("returns existing idempotent run without new model call", async () => {
    const repository = new InMemoryRecommendationsRepository({
      existingRun: createRunDetailRecord()
    });
    let modelCalls = 0;
    const service = new AiJobRecommendationsService(repository, {
      modelApiClient: {
        analyzeJobFit: () => Promise.reject(new Error("Not used")),
        analyzeCv: () => Promise.reject(new Error("Not used")),
        recommendJobs: () => {
          modelCalls += 1;
          return Promise.resolve(
            modelApiFixtures.validJobRecommendationsResponse
          );
        }
      }
    });

    const result = await service.generateRecommendations(
      "user-1",
      "req_recommend_idempotent",
      {
        limit: 10,
        idempotencyKey: "idem-existing"
      }
    );

    expect(result.recommendationRun.id).toBe("run-existing");
    expect(modelCalls).toBe(0);
  });

  test("throws CV_ANALYSIS_REQUIRED when no analysis exists", async () => {
    const repository = new InMemoryRecommendationsRepository({
      latestCvAnalysisResult: null
    });
    const service = new AiJobRecommendationsService(repository, {
      modelApiClient: {
        analyzeJobFit: () => Promise.reject(new Error("Not used")),
        analyzeCv: () => Promise.reject(new Error("Not used")),
        recommendJobs: () =>
          Promise.resolve(modelApiFixtures.validJobRecommendationsResponse)
      }
    });

    await expectRejects(
      service.generateRecommendations("user-1", "req_no_cv_analysis", {
        limit: 10
      }),
      "VALIDATION_ERROR"
    );
  });

  test("throws MODEL_RESPONSE_INVALID when model returns unknown jobId", async () => {
    const repository = new InMemoryRecommendationsRepository();
    const firstRecommendation =
      modelApiFixtures.validJobRecommendationsResponse.recommendations.at(0);
    if (!firstRecommendation) {
      throw new Error(
        "Expected recommendation fixture to include at least one item"
      );
    }
    const service = new AiJobRecommendationsService(repository, {
      modelApiClient: {
        analyzeJobFit: () => Promise.reject(new Error("Not used")),
        analyzeCv: () => Promise.reject(new Error("Not used")),
        recommendJobs: () =>
          Promise.resolve({
            ...modelApiFixtures.validJobRecommendationsResponse,
            recommendations: [
              {
                ...firstRecommendation,
                jobId: "unknown-job-id"
              }
            ]
          })
      }
    });

    await expectRejects(
      service.generateRecommendations("user-1", "req_unknown_job", {
        limit: 10
      }),
      aiJobRecommendationsErrorCodes.modelResponseInvalid
    );
  });
});

class InMemoryRecommendationsRepository implements AiJobRecommendationsRepository {
  readonly snapshots: JobRecommendationRunSnapshotInput[] = [];

  constructor(
    private readonly state: {
      cvAnalysisResultById?: CvAnalysisResolverRecord | null;
      latestCvAnalysisResult?: CvAnalysisResolverRecord | null;
      preference?: PreferenceContext | null;
      candidates?: RecommendationCandidateRecord[];
      existingRun?: JobRecommendationRunDetailRecord | null;
      latestRun?: JobRecommendationRunDetailRecord | null;
    } = {}
  ) {}

  findCvAnalysisResultByIdForUser(): Promise<CvAnalysisResolverRecord | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "cvAnalysisResultById")
        ? (this.state.cvAnalysisResultById ?? null)
        : createContext().cvAnalysisResult
    );
  }

  findLatestCvAnalysisResultForUser(): Promise<CvAnalysisResolverRecord | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "latestCvAnalysisResult")
        ? (this.state.latestCvAnalysisResult ?? null)
        : createContext().cvAnalysisResult
    );
  }

  findUserPreference(): Promise<PreferenceContext | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "preference")
        ? (this.state.preference ?? null)
        : createContext().preference
    );
  }

  findRecommendationRunByUserAndIdempotencyKey(): Promise<JobRecommendationRunDetailRecord | null> {
    return Promise.resolve(this.state.existingRun ?? null);
  }

  findLatestRecommendationRunForUser(): Promise<JobRecommendationRunDetailRecord | null> {
    return Promise.resolve(this.state.latestRun ?? null);
  }

  findRecommendationRunByIdForUser(): Promise<JobRecommendationRunDetailRecord | null> {
    return Promise.resolve(this.state.latestRun ?? null);
  }

  findCandidateJobsForRecommendations(): Promise<
    RecommendationCandidateRecord[]
  > {
    return Promise.resolve(this.state.candidates ?? createContext().candidates);
  }

  createRecommendationRunSnapshot(
    input: JobRecommendationRunSnapshotInput
  ): Promise<JobRecommendationRunDetailRecord> {
    this.snapshots.push(structuredClone(input));
    return Promise.resolve(
      createRunDetailRecord({
        id: "run-created",
        recommendationCount: input.recommendationCount,
        candidateCount: input.candidateCount,
        items: input.items.map(
          (
            item: JobRecommendationRunSnapshotInput["items"][number],
            index: number
          ) => ({
            rank: index + 1,
            matchScore: item.matchScore,
            matchLevel: item.matchLevel,
            reasons: item.reasons,
            matchedSkills: item.matchedSkills,
            missingSkills: item.missingSkills,
            nextSteps: item.nextSteps,
            job:
              createContext().candidates[index]?.job ??
              createJob("job-fallback"),
            isBookmarked: false,
            hasApplied: false
          })
        )
      })
    );
  }
}

function createContext(): {
  userId: string;
  cvAnalysisResult: CvAnalysisResolverRecord;
  preference: PreferenceContext;
  candidates: RecommendationCandidateRecord[];
} {
  const jobA = createJob("11111111-1111-4111-8111-111111111111");
  const jobB = createJob("22222222-2222-4222-8222-222222222222");

  return {
    userId: "user-1",
    cvAnalysisResult: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: "user-1",
      jobListingId: jobA.id,
      analyzedAt: new Date("2026-05-18T00:00:00.000Z"),
      job: jobA,
      schemaVersion: "cv-analysis-v2",
      jobFitAlignment: {
        score: 80,
        summary: "Good fit",
        matchedSignals: ["TypeScript", "PostgreSQL"],
        missingSignals: ["Docker"]
      },
      topActionables: ["Add deployment experience"],
      sectionReviews: [
        {
          sectionName: "Relevant Skills",
          analysis: "Core skills are relevant but not well organized.",
          actionPoints: [
            "Kelompokkan skill backend, database, dan deployment."
          ],
          whyItsImportantForYou:
            "Organized technical keywords help ATS read the CV."
        }
      ]
    },
    preference: {
      targetRoles: ["Backend Developer"],
      locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
      workTypes: ["REMOTE"],
      salaryExpectation: {
        min: 5000000,
        max: 10000000,
        currency: "IDR",
        period: "MONTHLY"
      }
    },
    candidates: [
      {
        job: jobA,
        isBookmarked: false,
        hasApplied: false
      },
      {
        job: jobB,
        isBookmarked: true,
        hasApplied: false
      }
    ]
  };
}

function createRunDetailRecord(
  overrides: Partial<JobRecommendationRunDetailRecord> = {}
): JobRecommendationRunDetailRecord {
  const candidateJob = createContext().candidates[0]?.job ?? createJob("job-1");

  return {
    id: overrides.id ?? "run-existing",
    cvAnalysisResultId:
      overrides.cvAnalysisResultId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: overrides.createdAt ?? new Date("2026-05-18T10:00:00.000Z"),
    modelName: overrides.modelName ?? "fixture-job-recommendations-model",
    modelVersion: overrides.modelVersion ?? "test-2026-01",
    candidateCount: overrides.candidateCount ?? 2,
    recommendationCount: overrides.recommendationCount ?? 1,
    items: overrides.items ?? [
      {
        rank: 1,
        matchScore: 86,
        matchLevel: "STRONG",
        reasons: ["Kecocokan skill backend utama sudah kuat."],
        matchedSkills: ["TypeScript", "PostgreSQL"],
        missingSkills: ["Docker"],
        nextSteps: ["Add deployment experience to the CV."],
        job: candidateJob,
        isBookmarked: false,
        hasApplied: false
      }
    ]
  };
}

function createJob(jobId: string): JobRecord {
  return {
    id: jobId,
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description: "Build APIs with TypeScript and PostgreSQL.",
    requirementSummary: "TypeScript, PostgreSQL, REST API",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: {
      display: "Jakarta Selatan, DKI Jakarta",
      province: "DKI Jakarta",
      city: "Jakarta Selatan"
    },
    salary: {
      min: 5000000,
      max: 10000000,
      currency: "IDR",
      period: "MONTHLY",
      display: null
    },
    sourceUrl: "https://example.test/job",
    externalApplyUrl: "https://example.test/apply",
    postedAt: new Date("2026-04-20T00:00:00.000Z"),
    sourceUpdatedAt: null,
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-22T00:00:00.000Z"),
    company: {
      id: "company-1",
      name: "Nusantara Tech",
      logoUrl: null
    },
    sourcePlatform: {
      id: "source-1",
      name: "Glints",
      slug: "glints"
    },
    requirements: [
      {
        type: "SKILL",
        value: "TypeScript",
        priority: "HIGH",
        sortOrder: 0
      }
    ],
    skills: [{ name: "TypeScript" }, { name: "PostgreSQL" }]
  };
}

async function expectRejects(promise: Promise<unknown>, expectedCode: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject");
  } catch (error) {
    expect(error).toMatchObject({ code: expectedCode });
  }
}
