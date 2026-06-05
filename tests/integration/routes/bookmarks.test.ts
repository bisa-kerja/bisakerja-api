import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import { AuthenticationError } from "@/core/errors/app.error";
import type {
  BookmarkListResult,
  BookmarkRecord,
  BookmarksRepository
} from "@/modules/bookmarks";
import type { ListBookmarksQueryInput } from "@/modules/bookmarks/bookmarks.schema";
import type { AuthUser } from "@/modules/auth";
import type { JobRecord } from "@/modules/jobs";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const now = new Date("2026-04-23T00:00:00.000Z");

describe("bookmarks routes", () => {
  test("requires authentication", async () => {
    const context = createBookmarksRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/bookmarks",
      headers: { "x-request-id": "req_bookmarks_no_auth" }
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_bookmarks_no_auth"
      }
    });
  });

  test("saves an existing job and rejects duplicate, missing, and injected user id", async () => {
    const context = createBookmarksRouteContext();
    const jobId = "11111111-1111-4111-8111-111111111111";

    const saved = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/bookmarks",
      headers: authHeaders("user-1", "req_bookmarks_save"),
      body: { jobId }
    });

    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({
      success: true,
      message: "Job saved successfully",
      data: {
        jobId,
        createdAt: "2026-04-22T00:00:00.000Z"
      },
      meta: null
    });

    const duplicate = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/bookmarks",
      headers: authHeaders("user-1", "req_bookmarks_duplicate"),
      body: { jobId }
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({
      error: {
        code: "BOOKMARK_ALREADY_EXISTS",
        requestId: "req_bookmarks_duplicate"
      }
    });

    const missing = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/bookmarks",
      headers: authHeaders("user-1", "req_bookmarks_missing_job"),
      body: { jobId: "99999999-9999-4999-8999-999999999999" }
    });

    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({
      error: { code: "JOB_NOT_FOUND" }
    });

    const userIdInjection = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/bookmarks",
      headers: authHeaders("user-1", "req_bookmarks_user_id"),
      body: { jobId, userId: "user-2" }
    });

    expect(userIdInjection.status).toBe(422);
    expect(userIdInjection.body).toMatchObject({
      error: {
        details: [expect.objectContaining({ path: "userId" })]
      }
    });
  });

  test("lists only current user's bookmarks with pagination metadata and safe job card fields", async () => {
    const context = createBookmarksRouteContext();

    await context.repository.seedBookmark(
      "user-1",
      "11111111-1111-4111-8111-111111111111"
    );
    await context.repository.seedBookmark(
      "user-2",
      "22222222-2222-4222-8222-222222222222"
    );

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/bookmarks?keyword=backend&page=1&limit=20&sort=created_desc",
      headers: authHeaders("user-1", "req_bookmarks_list")
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Bookmarks retrieved successfully",
      data: [
        {
          id: "bookmark-user-1-11111111",
          job: {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Backend Developer",
            company: { name: "Nusantara Tech" },
            sourcePlatform: { slug: "glints" },
            employmentType: "FULL_TIME",
            experienceLevel: "ENTRY_LEVEL",
            isStale: false
          }
        }
      ],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        filters: { keyword: "backend" },
        sort: "created_desc"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("externalJobId");
    expect(JSON.stringify(response.body)).not.toContain("sourcePayload");
  });

  test("deletes only current user's bookmark and hides non-owned records", async () => {
    const context = createBookmarksRouteContext();
    const jobId = "11111111-1111-4111-8111-111111111111";

    await context.repository.seedBookmark("user-1", jobId);

    const deleted = await injectRoute(context.app, {
      method: "DELETE",
      url: `/api/v1/me/bookmarks/${jobId}`,
      headers: authHeaders("user-1", "req_bookmarks_delete")
    });

    expect(deleted.status).toBe(204);
    expect(deleted.body).toBeNull();

    await context.repository.seedBookmark("user-1", jobId);

    const otherUser = await injectRoute(context.app, {
      method: "DELETE",
      url: `/api/v1/me/bookmarks/${jobId}`,
      headers: authHeaders("user-2", "req_bookmarks_delete_other")
    });

    expect(otherUser.status).toBe(404);
    expect(otherUser.body).toMatchObject({
      error: {
        code: "BOOKMARK_NOT_FOUND",
        requestId: "req_bookmarks_delete_other"
      }
    });

    const invalidParam = await injectRoute(context.app, {
      method: "DELETE",
      url: "/api/v1/me/bookmarks/not-a-uuid",
      headers: authHeaders("user-1", "req_bookmarks_bad_param")
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
});

function createBookmarksRouteContext(jobs: JobRecord[] = jobRecords()) {
  const repository = new InMemoryBookmarksRepository(jobs);
  const authMiddleware = createTestAuthMiddleware(repository);
  const app = createApp(testConfig({ JOB_STALE_AFTER_HOURS: "72" }), {
    routes: {
      bookmarks: {
        repository,
        authMiddleware,
        now: () => now
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

function createTestAuthMiddleware(
  repository: InMemoryBookmarksRepository
): RequestHandler {
  return (req, _res, next) => {
    const header = req.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      next(new AuthenticationError());
      return;
    }

    const userId = header.slice("Bearer ".length).trim();
    const authUser = repository.getAuthUser(userId);

    if (!authUser) {
      next(new AuthenticationError());
      return;
    }

    req.auth = {
      userId: authUser.id,
      user: authUser
    };

    next();
  };
}

class InMemoryBookmarksRepository implements BookmarksRepository {
  private readonly bookmarks = new Map<string, BookmarkRecord>();
  private readonly users = new Set(["user-1", "user-2"]);

  constructor(private readonly jobs: JobRecord[]) {}

  listForUser(
    userId: string,
    query: ListBookmarksQueryInput
  ): Promise<BookmarkListResult> {
    const filtered = [...this.bookmarks.values()]
      .filter((bookmark) => bookmark.userId === userId)
      .filter((bookmark) => bookmark.job.status !== "HIDDEN")
      .filter((bookmark) => matchesQuery(bookmark.job, query));
    const sorted = sortBookmarks(filtered, query.sort);
    const start = (query.page - 1) * query.limit;

    return Promise.resolve({
      items: sorted.slice(start, start + query.limit),
      total: filtered.length
    });
  }

  findVisibleJobById(jobId: string): Promise<JobRecord | null> {
    return Promise.resolve(
      this.jobs.find(
        (job) => job.id === jobId && ["ACTIVE", "STALE"].includes(job.status)
      ) ?? null
    );
  }

  findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<BookmarkRecord | null> {
    return Promise.resolve(this.bookmarks.get(key(userId, jobId)) ?? null);
  }

  createForUser(userId: string, jobId: string): Promise<BookmarkRecord> {
    const job = this.jobs.find((item) => item.id === jobId);

    if (!job) {
      throw new Error("Job fixture missing");
    }

    return this.seedBookmark(userId, jobId, job);
  }

  deleteByUserAndJob(userId: string, jobId: string): Promise<boolean> {
    return Promise.resolve(this.bookmarks.delete(key(userId, jobId)));
  }

  seedBookmark(
    userId: string,
    jobId: string,
    job = this.jobs.find((item) => item.id === jobId)
  ): Promise<BookmarkRecord> {
    if (!job) {
      throw new Error("Job fixture missing");
    }

    const bookmark: BookmarkRecord = {
      id: `bookmark-${userId}-${jobId.slice(0, 8)}`,
      userId,
      jobListingId: jobId,
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
      job
    };

    this.bookmarks.set(key(userId, jobId), bookmark);
    return Promise.resolve(bookmark);
  }

  getAuthUser(userId: string): AuthUser | null {
    if (!this.users.has(userId)) {
      return null;
    }

    return {
      id: userId,
      username: userId,
      email: `${userId}@example.test`,
      emailVerified: true,
      onboardingStatus: "IN_PROGRESS",
      createdAt: now
    };
  }
}

function matchesQuery(job: JobRecord, query: ListBookmarksQueryInput) {
  if (!query.keyword) {
    return true;
  }

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

  return searchable.includes(query.keyword.toLowerCase());
}

function sortBookmarks(
  bookmarks: BookmarkRecord[],
  sort: ListBookmarksQueryInput["sort"]
) {
  const sorted = [...bookmarks];

  if (sort === "updated_desc") {
    return sorted.sort((left, right) => {
      return right.job.updatedAt.getTime() - left.job.updatedAt.getTime();
    });
  }

  if (sort === "newest") {
    return sorted.sort((left, right) => {
      return (
        (right.job.postedAt ?? right.job.lastSeenAt).getTime() -
        (left.job.postedAt ?? left.job.lastSeenAt).getTime()
      );
    });
  }

  if (sort === "salary_highest") {
    return sorted.sort((left, right) => {
      return (right.job.salary.max ?? -1) - (left.job.salary.max ?? -1);
    });
  }

  if (sort === "salary_lowest") {
    return sorted.sort((left, right) => {
      return (
        (left.job.salary.min ?? Number.MAX_SAFE_INTEGER) -
        (right.job.salary.min ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }

  return sorted.sort((left, right) => {
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function key(userId: string, jobId: string) {
  return `${userId}:${jobId}`;
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
    employmentType: "FULL_TIME",
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
    updatedAt: new Date(input.postedAt.getTime() + 1_000),
    company: {
      id: `company-${input.sourceSlug}`,
      name: input.companyName,
      logoUrl: null,
      websiteUrl: "https://example.test/company"
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
