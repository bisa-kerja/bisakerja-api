import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { hasSalaryOverlap } from "@/modules/jobs/jobs.mapper";
import type { ListJobsQueryInput } from "@/modules/jobs/jobs.schema";
import type {
  JobListResult,
  JobRecord,
  JobsRepository
} from "@/modules/jobs/jobs.types";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const now = new Date("2026-04-23T00:00:00.000Z");

describe("jobs routes", () => {
  test("lists jobs publicly with pagination metadata", async () => {
    const context = createJobsRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs?page=1&limit=2",
      headers: { "x-request-id": "req_jobs_list" }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Jobs retrieved successfully",
      meta: {
        pagination: {
          page: 1,
          limit: 2,
          total: 3,
          totalPages: 2,
          hasNextPage: true,
          hasPrevPage: false
        },
        sort: "newest"
      }
    });
    expect(response.body).toHaveProperty("data");
    expect((response.body as { data: unknown[] }).data[0]).toMatchObject({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Data Analyst",
      company: { name: "Data Nusantara" },
      sourcePlatform: { slug: "jobstreet" }
    });
    expect(JSON.stringify(response.body)).not.toContain("externalJobId");
  });

  test("returns an empty list with stable envelope", async () => {
    const context = createJobsRouteContext([]);

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs",
      headers: { "x-request-id": "req_jobs_empty" }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: {
        pagination: {
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      }
    });
  });

  test("applies keyword, filters, and sort metadata", async () => {
    const context = createJobsRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs?keyword=backend&workType=REMOTE&sourcePlatform=glints&skill=TypeScript&sort=relevance",
      headers: { "x-request-id": "req_jobs_search" }
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [{ title: "Backend Developer" }],
      meta: {
        filters: {
          keyword: "backend",
          workType: "REMOTE",
          sourcePlatform: "glints",
          skill: "TypeScript"
        },
        sort: "relevance"
      }
    });
  });

  test("validates unsupported query values and params", async () => {
    const context = createJobsRouteContext();

    const invalidQuery = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs?workType=WFH",
      headers: { "x-request-id": "req_jobs_bad_query" }
    });

    expect(invalidQuery.status).toBe(422);
    expect(invalidQuery.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        requestId: "req_jobs_bad_query"
      }
    });
    expect(invalidQuery.body).toMatchObject({
      error: {
        details: [expect.objectContaining({ path: "workType" })]
      }
    });

    const invalidParam = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs/not-a-uuid",
      headers: { "x-request-id": "req_jobs_bad_param" }
    });

    expect(invalidParam.status).toBe(422);
    expect(invalidParam.body).toMatchObject({
      error: {
        details: [
          expect.objectContaining({
            path: "jobId",
            message: "Job ID is invalid. Use a valid UUID"
          })
        ]
      }
    });
  });

  test("returns job detail and maps missing jobs to JOB_NOT_FOUND", async () => {
    const context = createJobsRouteContext();

    const detail = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs/11111111-1111-4111-8111-111111111111",
      headers: { "x-request-id": "req_jobs_detail" }
    });

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      success: true,
      message: "Job retrieved successfully",
      data: {
        title: "Backend Developer",
        company: {
          name: "Nusantara Tech",
          websiteUrl: "https://example.test/nusantara"
        },
        requirements: [
          { type: "SKILL", value: "TypeScript", priority: "HIGH" }
        ],
        skills: ["TypeScript"],
        externalApplyUrl: "https://glints.example/apply",
        isStale: false
      },
      meta: null
    });

    const missing = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/jobs/99999999-9999-4999-8999-999999999999",
      headers: { "x-request-id": "req_jobs_missing" }
    });

    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({
      error: {
        code: "JOB_NOT_FOUND",
        requestId: "req_jobs_missing"
      }
    });
  });
});

function createJobsRouteContext(jobs: JobRecord[] = jobRecords()) {
  const repository = new InMemoryJobsRepository(jobs);
  const app = createApp(testConfig({ JOB_STALE_AFTER_HOURS: "72" }), {
    routes: {
      jobs: {
        repository,
        now: () => now
      }
    }
  });

  return { app, repository };
}

class InMemoryJobsRepository implements JobsRepository {
  constructor(private readonly jobs: JobRecord[]) {}

  listJobs(query: ListJobsQueryInput): Promise<JobListResult> {
    const filtered = this.jobs
      .filter((job) => ["ACTIVE", "STALE"].includes(job.status))
      .filter((job) => matchesQuery(job, query));
    const sorted = sortJobs(filtered, query.sort);
    const start = (query.page - 1) * query.limit;

    return Promise.resolve({
      items: sorted.slice(start, start + query.limit),
      total: filtered.length
    });
  }

  findVisibleById(jobId: string): Promise<JobRecord | null> {
    return Promise.resolve(
      this.jobs.find((job) => job.id === jobId && job.status !== "HIDDEN") ??
        null
    );
  }
}

function matchesQuery(job: JobRecord, query: ListJobsQueryInput) {
  const searchable = [
    job.title,
    job.normalizedTitle,
    job.description,
    job.requirementSummary,
    job.company.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    (!query.keyword || searchable.includes(query.keyword.toLowerCase())) &&
    (!query.workType || job.workType === query.workType) &&
    (!query.employmentType || job.employmentType === query.employmentType) &&
    (!query.experienceLevel || job.experienceLevel === query.experienceLevel) &&
    (!query.sourcePlatform ||
      job.sourcePlatform.slug === query.sourcePlatform) &&
    (!query.province ||
      job.location.province
        ?.toLowerCase()
        .includes(query.province.toLowerCase())) &&
    (!query.city ||
      job.location.city?.toLowerCase().includes(query.city.toLowerCase())) &&
    (!query.location ||
      job.location.display
        ?.toLowerCase()
        .includes(query.location.toLowerCase())) &&
    (!query.category ||
      job.category?.toLowerCase().includes(query.category.toLowerCase())) &&
    (!query.skill ||
      job.skills.some((skill) =>
        skill.name.toLowerCase().includes(query.skill?.toLowerCase() ?? "")
      )) &&
    hasSalaryOverlap(
      job.salary.min,
      job.salary.max,
      query.salaryMin,
      query.salaryMax
    )
  );
}

function sortJobs(jobs: JobRecord[], sort: ListJobsQueryInput["sort"]) {
  const sorted = [...jobs];

  if (sort === "salary_highest") {
    return sorted.sort((left, right) => {
      return (right.salary.max ?? -1) - (left.salary.max ?? -1);
    });
  }

  if (sort === "salary_lowest") {
    return sorted.sort((left, right) => {
      return (
        (left.salary.min ?? Number.MAX_SAFE_INTEGER) -
        (right.salary.min ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }

  return sorted.sort((left, right) => {
    return (
      (right.postedAt ?? right.lastSeenAt).getTime() -
      (left.postedAt ?? left.lastSeenAt).getTime()
    );
  });
}

function jobRecords(): JobRecord[] {
  return [
    baseJob({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Backend Developer",
      sourceSlug: "glints",
      sourceName: "Glints",
      companyName: "Nusantara Tech",
      workType: "REMOTE",
      salaryMin: 5_000_000,
      salaryMax: 10_000_000,
      postedAt: new Date("2026-04-20T00:00:00.000Z")
    }),
    baseJob({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Data Analyst",
      sourceSlug: "jobstreet",
      sourceName: "Jobstreet",
      companyName: "Data Nusantara",
      workType: "HYBRID",
      salaryMin: 7_000_000,
      salaryMax: 12_000_000,
      postedAt: new Date("2026-04-21T00:00:00.000Z")
    }),
    baseJob({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Software Engineer Intern",
      sourceSlug: "dealls",
      sourceName: "Dealls",
      companyName: "Talenta Muda",
      workType: "REMOTE",
      employmentType: "INTERNSHIP",
      salaryMin: 2_000_000,
      salaryMax: 4_000_000,
      postedAt: new Date("2026-04-19T00:00:00.000Z")
    })
  ];
}

function baseJob(input: {
  id: string;
  title: string;
  sourceSlug: string;
  sourceName: string;
  companyName: string;
  workType: JobRecord["workType"];
  employmentType?: JobRecord["employmentType"];
  salaryMin: number;
  salaryMax: number;
  postedAt: Date;
}): JobRecord {
  return {
    id: input.id,
    title: input.title,
    normalizedTitle: input.title.toLowerCase(),
    category: "Engineering",
    description: "Build APIs.",
    requirementSummary: "TypeScript",
    workType: input.workType,
    employmentType: input.employmentType ?? "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: {
      display: "Jakarta Selatan, DKI Jakarta",
      province: "DKI Jakarta",
      city: "Jakarta Selatan"
    },
    salary: {
      min: input.salaryMin,
      max: input.salaryMax,
      currency: "IDR",
      period: "MONTHLY",
      display: null
    },
    sourceUrl: `https://${input.sourceSlug}.example/job`,
    externalApplyUrl: `https://${input.sourceSlug}.example/apply`,
    postedAt: input.postedAt,
    sourceUpdatedAt: null,
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    createdAt: input.postedAt,
    updatedAt: now,
    company: {
      id: `company-${input.sourceSlug}`,
      name: input.companyName,
      logoUrl: null,
      websiteUrl: "https://example.test/nusantara"
    },
    sourcePlatform: {
      id: `source-${input.sourceSlug}`,
      name: input.sourceName,
      slug: input.sourceSlug
    },
    requirements: [
      { type: "SKILL", value: "TypeScript", priority: "HIGH", sortOrder: 0 }
    ],
    skills: [{ name: "TypeScript" }]
  };
}
