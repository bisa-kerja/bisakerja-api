import { describe, expect, test } from "bun:test";

import {
  AiJobFitService,
  buildJobFitPayload,
  hasRequiredPreferenceContext,
  hasRequiredProfileContext,
  mapJobFitResource
} from "@/modules/ai-job-fit";
import { aiJobFitErrorCodes } from "@/modules/ai-job-fit/ai-job-fit.constants";
import type {
  AiJobFitRepository,
  AiJobFitUserContext,
  JobFitAnalysisSnapshotInput
} from "@/modules/ai-job-fit";
import type { JobRecord } from "@/modules/jobs";
import { modelApiFixtures } from "../../fixtures/model-api";

describe("AiJobFitService", () => {
  test("builds a backend-owned payload and normalizes optional fields", () => {
    const payload = buildJobFitPayload(
      "req_job_fit_unit",
      completeContext(),
      jobRecord()
    );

    expect(payload).toMatchObject({
      requestId: "req_job_fit_unit",
      inputVersion: "job-fit-v1",
      user: {
        careerStatus: "EARLY_CAREER",
        skills: [{ name: "TypeScript", level: "INTERMEDIATE" }]
      },
      preferences: {
        targetRoles: ["Backend Developer"],
        workTypes: ["REMOTE"]
      },
      job: {
        id: "11111111-1111-4111-8111-111111111111",
        requirements: [
          {
            type: "SKILL",
            value: "TypeScript",
            priority: "LOW"
          }
        ]
      }
    });
    expect(JSON.stringify(payload)).not.toContain("userId");
  });

  test("detects incomplete profile and preference context separately", () => {
    const context = completeContext();
    const preference = context.preference;

    if (!preference) {
      throw new Error("Expected complete test context preference");
    }

    expect(
      hasRequiredProfileContext({
        ...context,
        profile: null
      })
    ).toBe(false);
    expect(
      hasRequiredPreferenceContext({
        ...context,
        preference: {
          ...preference,
          targetRoles: []
        }
      })
    ).toBe(false);
  });

  test("returns product-safe analysis and persists snapshots only when requested", async () => {
    const repository = new InMemoryAiJobFitRepository();
    const service = new AiJobFitService(repository, {
      modelApiClient: {
        analyzeJobFit: () =>
          Promise.resolve(modelApiFixtures.validJobFitResponse),
        analyzeCv: () => Promise.reject(new Error("Not used"))
      }
    });

    const nonPersisted = await service.analyzeJobFit(
      "user-1",
      "req_job_fit_no_persist",
      {
        jobId: "11111111-1111-4111-8111-111111111111",
        persistResult: false
      }
    );
    const persisted = await service.analyzeJobFit(
      "user-1",
      "req_job_fit_persist",
      {
        jobId: "11111111-1111-4111-8111-111111111111",
        persistResult: true
      }
    );

    expect(nonPersisted).toMatchObject({
      persisted: false,
      resource: {
        jobId: "11111111-1111-4111-8111-111111111111",
        fitScore: 82
      }
    });
    expect(persisted.persisted).toBe(true);
    expect(repository.snapshots).toHaveLength(1);
  });

  test("throws documented conflict codes for incomplete context", async () => {
    const profileRepository = new InMemoryAiJobFitRepository({
      context: {
        ...completeContext(),
        profile: null
      }
    });
    const preferenceRepository = new InMemoryAiJobFitRepository({
      context: {
        ...completeContext(),
        preference: null
      }
    });
    const service = new AiJobFitService(profileRepository, {
      modelApiClient: {
        analyzeJobFit: () =>
          Promise.resolve(modelApiFixtures.validJobFitResponse),
        analyzeCv: () => Promise.reject(new Error("Not used"))
      }
    });

    try {
      await service.analyzeJobFit("user-1", "req_missing_profile", {
        jobId: "11111111-1111-4111-8111-111111111111",
        persistResult: false
      });
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 409,
        code: aiJobFitErrorCodes.profileIncomplete
      });
    }

    const preferenceService = new AiJobFitService(preferenceRepository, {
      modelApiClient: {
        analyzeJobFit: () =>
          Promise.resolve(modelApiFixtures.validJobFitResponse),
        analyzeCv: () => Promise.reject(new Error("Not used"))
      }
    });

    try {
      await preferenceService.analyzeJobFit(
        "user-1",
        "req_missing_preferences",
        {
          jobId: "11111111-1111-4111-8111-111111111111",
          persistResult: false
        }
      );
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 409,
        code: aiJobFitErrorCodes.preferencesIncomplete
      });
    }
  });

  test("maps nullable success probability to null", () => {
    const resource = mapJobFitResource("11111111-1111-4111-8111-111111111111", {
      ...modelApiFixtures.validJobFitResponse,
      recommendation: {
        ...modelApiFixtures.validJobFitResponse.recommendation,
        successProbability: null
      }
    });

    expect(resource.recommendation.successProbability).toBeNull();
  });
});

class InMemoryAiJobFitRepository implements AiJobFitRepository {
  readonly snapshots: JobFitAnalysisSnapshotInput[] = [];

  constructor(
    private readonly state: {
      context?: AiJobFitUserContext | null;
      job?: JobRecord | null;
    } = {}
  ) {}

  findUserContext(): Promise<AiJobFitUserContext | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "context")
        ? (this.state.context ?? null)
        : completeContext()
    );
  }

  findVisibleJob(): Promise<JobRecord | null> {
    return Promise.resolve(
      Object.hasOwn(this.state, "job") ? (this.state.job ?? null) : jobRecord()
    );
  }

  createSnapshot(input: JobFitAnalysisSnapshotInput): Promise<void> {
    this.snapshots.push(structuredClone(input));
    return Promise.resolve();
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
