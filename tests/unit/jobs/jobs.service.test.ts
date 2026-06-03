import { describe, expect, test } from "bun:test";

import { JobsService } from "@/modules/jobs";
import type {
  JobListResult,
  JobRecord,
  JobsRepository
} from "@/modules/jobs/jobs.types";

const now = new Date("2026-04-23T00:00:00.000Z");

describe("JobsService", () => {
  test("returns paginated list metadata and newest fallback for relevance without keyword", async () => {
    const service = new JobsService(new StaticJobsRepository([jobRecord()]), {
      staleAfterHours: 72,
      now: () => now
    });

    const result = await service.listJobs({
      page: 1,
      limit: 20,
      sort: "relevance"
    });

    expect(result.meta).toMatchObject({
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      },
      filters: {},
      sort: "newest"
    });
    expect(result.data).toHaveLength(1);
  });

  test("throws JOB_NOT_FOUND for missing detail", async () => {
    const service = new JobsService(new StaticJobsRepository([]), {
      staleAfterHours: 72,
      now: () => now
    });

    expect.assertions(1);

    try {
      await service.getJobDetail("11111111-1111-4111-8111-111111111111");
    } catch (error) {
      expect(error).toHaveProperty("message", "Job not found");
    }
  });
});

class StaticJobsRepository implements JobsRepository {
  constructor(private readonly jobs: JobRecord[]) {}

  listJobs(): Promise<JobListResult> {
    return Promise.resolve({ items: this.jobs, total: this.jobs.length });
  }

  findVisibleById(jobId: string): Promise<JobRecord | null> {
    return Promise.resolve(this.jobs.find((job) => job.id === jobId) ?? null);
  }
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
    location: { display: "Jakarta", province: "DKI Jakarta", city: "Jakarta" },
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
    requirements: [],
    skills: []
  };
}
