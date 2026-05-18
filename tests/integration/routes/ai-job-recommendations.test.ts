import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import {
  AuthenticationError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import type {
  AiJobRecommendationsRepository,
  CvAnalysisResolverRecord,
  JobRecommendationRunDetailRecord,
  JobRecommendationRunSnapshotInput,
  RecommendationCandidateRecord
} from "@/modules/ai-job-recommendations";
import type { AuthUser } from "@/modules/auth";
import type { JobRecord, JobsRepository } from "@/modules/jobs";
import type { PreferenceContext } from "@/modules/preferences/preferences.types";
import { modelApiFixtures } from "../../fixtures/model-api";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("ai job recommendations routes", () => {
  test("requires authentication", async () => {
    const context = createRouteContext();
    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-recommendations",
      headers: { "x-request-id": "req_recommend_no_auth" },
      body: { limit: 10 }
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_recommend_no_auth"
      }
    });
  });

  test("generates recommendations and returns 201", async () => {
    const context = createRouteContext();
    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-recommendations",
      headers: authHeaders("user-1", "req_recommend_success"),
      body: {
        cvAnalysisResultId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        limit: 2,
        idempotencyKey: "idem-route-1"
      }
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Rekomendasi pekerjaan berhasil dibuat",
      data: {
        recommendationRun: {
          id: "run-created",
          recommendationCount: 1
        },
        recommendations: [
          {
            job: {
              title: "Backend Developer"
            }
          }
        ]
      }
    });
    expect(context.repository.snapshots).toHaveLength(1);
  });

  test("returns latest run and run detail", async () => {
    const context = createRouteContext({
      latestRun: createRunDetailRecord()
    });

    const latestResponse = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/ai/job-recommendations/latest?limit=1",
      headers: authHeaders("user-1", "req_recommend_latest")
    });
    const detailResponse = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/ai/job-recommendations/11111111-1111-4111-8111-111111111111?limit=1",
      headers: authHeaders("user-1", "req_recommend_detail")
    });

    expect(latestResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
  });

  test("returns 404 when explicit cv analysis is not owned or missing", async () => {
    const context = createRouteContext({
      cvAnalysisResultById: null
    });
    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-recommendations",
      headers: authHeaders("user-1", "req_recommend_cv_missing"),
      body: {
        cvAnalysisResultId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      }
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: { code: "CV_ANALYSIS_RESULT_NOT_FOUND" }
    });
  });

  test("maps model service failure to 503 model-specific error code", async () => {
    const context = createRouteContext({
      recommendJobs: () =>
        Promise.reject(new ServiceUnavailableError("Model API tidak tersedia"))
    });
    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-recommendations",
      headers: authHeaders("user-1", "req_recommend_model_down"),
      body: {}
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: { code: "MODEL_SERVICE_UNAVAILABLE" }
    });
  });
});

function createRouteContext(
  overrides: {
    cvAnalysisResultById?: CvAnalysisResolverRecord | null;
    latestCvAnalysisResult?: CvAnalysisResolverRecord | null;
    preference?: PreferenceContext | null;
    candidates?: RecommendationCandidateRecord[];
    existingRun?: JobRecommendationRunDetailRecord | null;
    latestRun?: JobRecommendationRunDetailRecord | null;
    recommendJobs?: () => Promise<
      typeof modelApiFixtures.validJobRecommendationsResponse
    >;
  } = {}
) {
  const repository = new InMemoryRecommendationsRepository(overrides);
  const jobsRepository = new StaticJobsRepository([createJob()]);
  const authMiddleware = createTestAuthMiddleware();
  const firstRecommendation =
    modelApiFixtures.validJobRecommendationsResponse.recommendations.at(0);
  if (!firstRecommendation) {
    throw new Error(
      "Expected recommendation fixture to include at least one item"
    );
  }
  const app = createApp(testConfig({ MODEL_API_ENABLE_MOCK: "false" }), {
    routes: {
      aiJobRecommendations: {
        repository,
        authMiddleware,
        modelApiClient: {
          analyzeJobFit: () => Promise.reject(new Error("Not used")),
          analyzeCv: () => Promise.reject(new Error("Not used")),
          recommendJobs: () =>
            overrides.recommendJobs
              ? overrides.recommendJobs()
              : Promise.resolve({
                  ...modelApiFixtures.validJobRecommendationsResponse,
                  recommendations: [
                    {
                      ...firstRecommendation,
                      jobId: "11111111-1111-4111-8111-111111111111"
                    }
                  ]
                })
        }
      },
      jobs: {
        repository: jobsRepository,
        now: () => new Date("2026-05-18T10:00:00.000Z")
      }
    }
  });

  return { app, repository };
}

function authHeaders(
  userId: string,
  requestId: string
): Record<string, string> {
  return {
    Authorization: `Bearer ${userId}`,
    "x-request-id": requestId
  };
}

function createTestAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    const header = req.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      next(new AuthenticationError());
      return;
    }

    const userId = header.slice("Bearer ".length).trim();
    const user: AuthUser = {
      id: userId,
      username: userId,
      email: `${userId}@example.test`,
      emailVerified: true,
      onboardingStatus: "COMPLETED",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    };

    req.auth = { userId, user };
    next();
  };
}

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
        : createCvAnalysisResult()
    );
  }

  findLatestCvAnalysisResultForUser(): Promise<CvAnalysisResolverRecord | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "latestCvAnalysisResult")
        ? (this.state.latestCvAnalysisResult ?? null)
        : createCvAnalysisResult()
    );
  }

  findUserPreference(): Promise<PreferenceContext | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "preference")
        ? (this.state.preference ?? null)
        : createPreference()
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
    return Promise.resolve(this.state.candidates ?? [createCandidate()]);
  }

  createRecommendationRunSnapshot(
    input: JobRecommendationRunSnapshotInput
  ): Promise<JobRecommendationRunDetailRecord> {
    this.snapshots.push(structuredClone(input));
    return Promise.resolve(
      createRunDetailRecord({
        id: "run-created",
        recommendationCount: input.recommendationCount,
        candidateCount: input.candidateCount
      })
    );
  }
}

class StaticJobsRepository implements JobsRepository {
  constructor(private readonly jobs: JobRecord[]) {}

  listJobs() {
    return Promise.resolve({ items: this.jobs, total: this.jobs.length });
  }

  findVisibleById(jobId: string): Promise<JobRecord | null> {
    return Promise.resolve(this.jobs.find((job) => job.id === jobId) ?? null);
  }
}

function createRunDetailRecord(
  overrides: Partial<JobRecommendationRunDetailRecord> = {}
): JobRecommendationRunDetailRecord {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
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
        nextSteps: ["Tambahkan pengalaman deployment di CV."],
        job: createJob(),
        isBookmarked: false,
        hasApplied: false
      }
    ]
  };
}

function createPreference(): PreferenceContext {
  return {
    targetRoles: ["Backend Developer"],
    locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
    workTypes: ["REMOTE"],
    salaryExpectation: {
      min: 5000000,
      max: 10000000,
      currency: "IDR",
      period: "MONTHLY"
    }
  };
}

function createCvAnalysisResult(): CvAnalysisResolverRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "user-1",
    jobListingId: "11111111-1111-4111-8111-111111111111",
    analyzedAt: new Date("2026-05-18T00:00:00.000Z"),
    job: createJob(),
    jobFitAlignment: {
      score: 80,
      summary: "Cocok",
      matchedSignals: ["TypeScript"],
      missingSignals: ["Docker"]
    },
    keywordOptimization: {
      recommendedKeywords: ["REST API"],
      reason: "Kebutuhan role backend"
    },
    actionableImprovements: ["Tambah pengalaman deploy"]
  };
}

function createCandidate(): RecommendationCandidateRecord {
  return {
    job: createJob(),
    isBookmarked: false,
    hasApplied: false
  };
}

function createJob(): JobRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
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
    company: { id: "company-1", name: "Nusantara Tech", logoUrl: null },
    sourcePlatform: { id: "source-1", name: "Glints", slug: "glints" },
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
