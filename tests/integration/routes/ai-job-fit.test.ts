import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import {
  AuthenticationError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import type {
  AiJobFitRepository,
  AiJobFitUserContext,
  JobFitAnalysisSnapshotInput
} from "@/modules/ai-job-fit";
import type { AuthUser } from "@/modules/auth";
import type { JobRecord, JobsRepository } from "@/modules/jobs";
import { modelApiFixtures } from "../../fixtures/model-api";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("ai job fit routes", () => {
  test("requires authentication", async () => {
    const context = createAiJobFitRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: { "x-request-id": "req_ai_job_fit_no_auth" },
      body: { jobId: jobRecord().id }
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_ai_job_fit_no_auth"
      }
    });
  });

  test("returns validation error for injected profile fields", async () => {
    const context = createAiJobFitRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeaders("user-1", "req_ai_job_fit_validation"),
      body: {
        jobId: jobRecord().id,
        profile: { careerStatus: "EARLY_CAREER" }
      }
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        details: [expect.objectContaining({ path: "profile" })]
      }
    });
  });

  test("returns separated conflict codes for incomplete profile and preferences", async () => {
    const missingProfile = createAiJobFitRouteContext({
      context: { ...completeContext(), profile: null }
    });
    const missingPreferences = createAiJobFitRouteContext({
      context: { ...completeContext(), preference: null }
    });

    const profileResponse = await injectRoute(missingProfile.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeaders("user-1", "req_ai_job_fit_profile_incomplete"),
      body: { jobId: jobRecord().id }
    });
    const preferencesResponse = await injectRoute(missingPreferences.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeaders("user-1", "req_ai_job_fit_preferences_incomplete"),
      body: { jobId: jobRecord().id }
    });

    expect(profileResponse.status).toBe(409);
    expect(profileResponse.body).toMatchObject({
      error: { code: "PROFILE_INCOMPLETE" }
    });
    expect(preferencesResponse.status).toBe(409);
    expect(preferencesResponse.body).toMatchObject({
      error: { code: "PREFERENCES_INCOMPLETE" }
    });
  });

  test("returns success, persists when requested, and does not leak request payloads", async () => {
    const context = createAiJobFitRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeaders("user-1", "req_ai_job_fit_success"),
      body: {
        jobId: jobRecord().id,
        persistResult: true
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Analisis kecocokan pekerjaan berhasil diselesaikan",
      data: {
        jobId: jobRecord().id,
        fitScore: 82,
        recommendation: {
          decision: "APPLY_NOW"
        }
      },
      meta: null
    });
    expect(context.repository.snapshots).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain("inputVersion");
    expect(JSON.stringify(response.body)).not.toContain("requestId");
  });

  test("returns 404 when job is missing without calling the model client", async () => {
    const context = createAiJobFitRouteContext({
      job: null
    });

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeaders("user-1", "req_ai_job_fit_missing_job"),
      body: { jobId: "99999999-9999-4999-8999-999999999999" }
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: { code: "JOB_NOT_FOUND" }
    });
    expect(context.modelCallCount()).toBe(0);
  });

  test("isolates ai failure from jobs routes", async () => {
    const context = createAiJobFitRouteContext({
      analyzeJobFit: () =>
        Promise.reject(new ServiceUnavailableError("Model API tidak tersedia"))
    });

    const aiResponse = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeaders("user-1", "req_ai_job_fit_failure"),
      body: { jobId: jobRecord().id }
    });
    const jobsResponse = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs",
      headers: { "x-request-id": "req_jobs_after_ai_failure" }
    });

    expect(aiResponse.status).toBe(503);
    expect(aiResponse.body).toMatchObject({
      error: {
        code: "SERVICE_UNAVAILABLE",
        requestId: "req_ai_job_fit_failure"
      }
    });
    expect(jobsResponse.status).toBe(200);
    expect(jobsResponse.body).toMatchObject({
      success: true,
      data: [
        {
          id: jobRecord().id,
          title: "Backend Developer"
        }
      ]
    });
  });
});

function createAiJobFitRouteContext(
  overrides: {
    context?: AiJobFitUserContext | null;
    job?: JobRecord | null;
    analyzeJobFit?: () => Promise<typeof modelApiFixtures.validJobFitResponse>;
  } = {}
) {
  const hasCustomContext = Object.hasOwn(overrides, "context");
  const hasCustomJob = Object.hasOwn(overrides, "job");
  const repository = new InMemoryAiJobFitRepository(
    hasCustomContext ? (overrides.context ?? null) : completeContext(),
    hasCustomJob ? (overrides.job ?? null) : jobRecord()
  );
  const jobsRepository = new StaticJobsRepository(
    hasCustomJob && overrides.job ? [overrides.job] : [jobRecord()]
  );
  const authMiddleware = createTestAuthMiddleware();
  let modelCallCount = 0;

  const app = createApp(testConfig({ MODEL_API_ENABLE_MOCK: "false" }), {
    routes: {
      aiJobFit: {
        repository,
        authMiddleware,
        modelApiClient: {
          analyzeJobFit: () => {
            modelCallCount += 1;
            if (overrides.analyzeJobFit) {
              return overrides.analyzeJobFit();
            }

            return Promise.resolve(modelApiFixtures.validJobFitResponse);
          },
          analyzeCv: () => Promise.reject(new Error("Not used"))
        }
      },
      jobs: {
        repository: jobsRepository,
        now: () => new Date("2026-04-23T00:00:00.000Z")
      }
    }
  });

  return { app, repository, modelCallCount: () => modelCallCount };
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
      createdAt: new Date("2026-04-23T00:00:00.000Z")
    };

    req.auth = { userId, user };
    next();
  };
}

class InMemoryAiJobFitRepository implements AiJobFitRepository {
  readonly snapshots: JobFitAnalysisSnapshotInput[] = [];

  constructor(
    private readonly context: AiJobFitUserContext | null,
    private readonly job: JobRecord | null
  ) {}

  findUserContext(): Promise<AiJobFitUserContext | null> {
    return Promise.resolve(this.context);
  }

  findVisibleJob(): Promise<JobRecord | null> {
    return Promise.resolve(this.job);
  }

  createSnapshot(input: JobFitAnalysisSnapshotInput): Promise<void> {
    this.snapshots.push(structuredClone(input));
    return Promise.resolve();
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

function completeContext(): AiJobFitUserContext {
  return {
    userId: "user-1",
    profile: {
      careerStatus: "EARLY_CAREER",
      latestRole: "Backend Developer",
      summary: "Build APIs",
      profilePhotoStorageKey: null,
      profilePhotoUrl: null,
      profilePhotoMimeType: null,
      profilePhotoSizeBytes: null
    },
    skills: [
      {
        id: "skill-user-1",
        name: "TypeScript",
        level: "INTERMEDIATE"
      }
    ],
    experience: [
      {
        id: "exp-1",
        title: "Backend Intern",
        company: "Nusantara Tech",
        employmentType: "INTERNSHIP",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-01T00:00:00.000Z"),
        isCurrent: false,
        description: "Built APIs"
      }
    ],
    preference: {
      targetRoles: ["Backend Developer"],
      locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
      workTypes: ["REMOTE"],
      salaryExpectation: {
        min: 5_000_000,
        max: 10_000_000,
        currency: "IDR",
        period: "MONTHLY"
      }
    }
  };
}

function jobRecord(): JobRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description: "Build APIs.",
    requirementSummary: "TypeScript",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: {
      display: "Jakarta Selatan, DKI Jakarta",
      province: "DKI Jakarta",
      city: "Jakarta Selatan"
    },
    salary: {
      min: 5_000_000,
      max: 10_000_000,
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
        priority: null,
        sortOrder: 0
      }
    ],
    skills: [{ name: "TypeScript" }]
  };
}
