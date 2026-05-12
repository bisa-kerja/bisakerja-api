import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import { AuthenticationError } from "@/core/errors/app.error";
import type { AuthUser } from "@/modules/auth";
import type {
  ApplicationListResult,
  ApplicationRecord,
  ApplicationsRepository,
  ApplicationStatusHistoryRecord
} from "@/modules/applications";
import type {
  CreateApplicationInput,
  ListApplicationsQueryInput,
  UpdateApplicationInput,
  UpdateApplicationStatusInput
} from "@/modules/applications/applications.schema";
import type { JobRecord } from "@/modules/jobs";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const now = new Date("2026-04-23T00:00:00.000Z");

describe("applications routes", () => {
  test("requires authentication", async () => {
    const context = createApplicationsRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/applications",
      headers: { "x-request-id": "req_applications_no_auth" }
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_applications_no_auth"
      }
    });
  });

  test("creates tracker record and rejects duplicate, missing job, invalid status, and injected user id", async () => {
    const context = createApplicationsRouteContext();
    const jobId = "11111111-1111-4111-8111-111111111111";

    const created = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/applications",
      headers: authHeaders("user-1", "req_applications_create"),
      body: {
        jobId,
        notes: "Applied from Glints",
        source: "EXTERNAL_APPLY_CLICK"
      }
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      success: true,
      message: "Lamaran berhasil dibuat",
      data: {
        status: "APPLIED",
        source: "EXTERNAL_APPLY_CLICK",
        notes: "Applied from Glints",
        job: { id: jobId }
      },
      meta: null
    });
    expect(context.repository.history).toHaveLength(1);

    const duplicate = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/applications",
      headers: authHeaders("user-1", "req_applications_duplicate"),
      body: { jobId }
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({
      error: {
        code: "APPLICATION_ALREADY_TRACKED",
        requestId: "req_applications_duplicate"
      }
    });

    const missing = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/applications",
      headers: authHeaders("user-1", "req_applications_missing_job"),
      body: { jobId: "99999999-9999-4999-8999-999999999999" }
    });

    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({
      error: { code: "JOB_NOT_FOUND" }
    });

    const invalidInitialStatus = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/applications",
      headers: authHeaders("user-2", "req_applications_bad_initial_status"),
      body: { jobId, status: "INTERVIEW" }
    });

    expect(invalidInitialStatus.status).toBe(409);
    expect(invalidInitialStatus.body).toMatchObject({
      error: { code: "APPLICATION_STATUS_CONFLICT" }
    });

    const userIdInjection = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/me/applications",
      headers: authHeaders("user-2", "req_applications_user_id"),
      body: { jobId, userId: "user-1" }
    });

    expect(userIdInjection.status).toBe(422);
  });

  test("lists only current user's applications with status filter and safe job fields", async () => {
    const context = createApplicationsRouteContext();

    await context.repository.seedApplication(
      "user-1",
      "11111111-1111-4111-8111-111111111111",
      { status: "APPLIED", notes: "backend role" }
    );
    await context.repository.seedApplication(
      "user-2",
      "22222222-2222-4222-8222-222222222222",
      { status: "APPLIED", notes: "other user" }
    );
    await context.repository.seedApplication(
      "user-1",
      "22222222-2222-4222-8222-222222222222",
      { status: "INTERVIEW", notes: "data role" }
    );

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/applications?keyword=backend&status=APPLIED&page=1&limit=20&sort=updated_desc",
      headers: authHeaders("user-1", "req_applications_list")
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Daftar lamaran berhasil diambil",
      data: [
        {
          status: "APPLIED",
          notes: "backend role",
          job: {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Backend Developer",
            company: { name: "Nusantara Tech" },
            sourcePlatform: { slug: "glints" },
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
        filters: { keyword: "backend", status: "APPLIED" },
        sort: "updated_desc"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("externalJobId");
    expect(JSON.stringify(response.body)).not.toContain("sourcePayload");
  });

  test("updates metadata only for current user's application", async () => {
    const context = createApplicationsRouteContext();
    const application = await context.repository.seedApplication(
      "user-1",
      "11111111-1111-4111-8111-111111111111"
    );

    const updated = await injectRoute(context.app, {
      method: "PATCH",
      url: `/api/v1/me/applications/${application.id}`,
      headers: authHeaders("user-1", "req_applications_update"),
      body: { notes: null, source: "EXTERNAL_APPLY_CLICK" }
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      success: true,
      message: "Lamaran berhasil diperbarui",
      data: {
        id: application.id,
        notes: null,
        source: "EXTERNAL_APPLY_CLICK"
      }
    });

    const otherUser = await injectRoute(context.app, {
      method: "PATCH",
      url: `/api/v1/me/applications/${application.id}`,
      headers: authHeaders("user-2", "req_applications_update_other"),
      body: { notes: "No access" }
    });

    expect(otherUser.status).toBe(404);
    expect(otherUser.body).toMatchObject({
      error: {
        code: "APPLICATION_NOT_FOUND",
        requestId: "req_applications_update_other"
      }
    });

    const emptyPatch = await injectRoute(context.app, {
      method: "PATCH",
      url: `/api/v1/me/applications/${application.id}`,
      headers: authHeaders("user-1", "req_applications_empty_patch"),
      body: {}
    });

    expect(emptyPatch.status).toBe(422);
  });

  test("updates status, appends history, and rejects invalid transition", async () => {
    const context = createApplicationsRouteContext();
    const application = await context.repository.seedApplication(
      "user-1",
      "11111111-1111-4111-8111-111111111111"
    );

    const updated = await injectRoute(context.app, {
      method: "PATCH",
      url: `/api/v1/me/applications/${application.id}/status`,
      headers: authHeaders("user-1", "req_applications_status"),
      body: { status: "INTERVIEW", notes: "Interview scheduled" }
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      success: true,
      message: "Status lamaran berhasil diperbarui",
      data: {
        id: application.id,
        status: "INTERVIEW",
        notes: "Interview scheduled"
      }
    });
    expect(context.repository.history.at(-1)).toMatchObject({
      applicationRecordId: application.id,
      fromStatus: "APPLIED",
      toStatus: "INTERVIEW"
    });

    const otherUser = await injectRoute(context.app, {
      method: "PATCH",
      url: `/api/v1/me/applications/${application.id}/status`,
      headers: authHeaders("user-2", "req_applications_status_other"),
      body: { status: "REJECTED" }
    });

    expect(otherUser.status).toBe(404);
    expect(otherUser.body).toMatchObject({
      error: {
        code: "APPLICATION_NOT_FOUND",
        requestId: "req_applications_status_other"
      }
    });

    const invalidTransition = await injectRoute(context.app, {
      method: "PATCH",
      url: `/api/v1/me/applications/${application.id}/status`,
      headers: authHeaders("user-1", "req_applications_status_conflict"),
      body: { status: "INTERVIEW" }
    });

    expect(invalidTransition.status).toBe(409);
    expect(invalidTransition.body).toMatchObject({
      error: {
        code: "APPLICATION_STATUS_CONFLICT",
        requestId: "req_applications_status_conflict"
      }
    });
  });
});

function createApplicationsRouteContext(jobs: JobRecord[] = jobRecords()) {
  const repository = new InMemoryApplicationsRepository(jobs);
  const authMiddleware = createTestAuthMiddleware(repository);
  const app = createApp(testConfig({ JOB_STALE_AFTER_HOURS: "72" }), {
    routes: {
      applications: {
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
  repository: InMemoryApplicationsRepository
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

class InMemoryApplicationsRepository implements ApplicationsRepository {
  readonly history: ApplicationStatusHistoryRecord[] = [];
  private readonly applications = new Map<string, ApplicationRecord>();
  private readonly users = new Set(["user-1", "user-2"]);

  constructor(private readonly jobs: JobRecord[]) {}

  listForUser(
    userId: string,
    query: ListApplicationsQueryInput
  ): Promise<ApplicationListResult> {
    const filtered = [...this.applications.values()]
      .filter((application) => application.userId === userId)
      .filter((application) => application.job.status !== "HIDDEN")
      .filter((application) => matchesQuery(application, query));
    const sorted = sortApplications(filtered, query.sort);
    const start = (query.page - 1) * query.limit;

    return Promise.resolve({
      items: sorted.slice(start, start + query.limit),
      total: filtered.length
    });
  }

  findTrackableJobById(jobId: string): Promise<JobRecord | null> {
    return Promise.resolve(
      this.jobs.find((job) => job.id === jobId && job.status !== "HIDDEN") ??
        null
    );
  }

  findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<ApplicationRecord | null> {
    return Promise.resolve(
      [...this.applications.values()].find(
        (application) =>
          application.userId === userId && application.jobListingId === jobId
      ) ?? null
    );
  }

  findByIdForUser(
    userId: string,
    applicationId: string
  ): Promise<ApplicationRecord | null> {
    const application = this.applications.get(applicationId);
    return Promise.resolve(application?.userId === userId ? application : null);
  }

  createForUser(
    userId: string,
    input: CreateApplicationInput
  ): Promise<ApplicationRecord> {
    return this.seedApplication(userId, input.jobId, input);
  }

  updateForUser(
    userId: string,
    applicationId: string,
    input: UpdateApplicationInput
  ): Promise<ApplicationRecord | null> {
    const application = this.applications.get(applicationId);

    if (application?.userId !== userId) {
      return Promise.resolve(null);
    }

    const updated = {
      ...application,
      notes: input.notes !== undefined ? input.notes : application.notes,
      source: input.source ?? application.source,
      updatedAt: now
    };
    this.applications.set(applicationId, updated);
    return Promise.resolve(updated);
  }

  updateStatusForUser(
    userId: string,
    applicationId: string,
    input: UpdateApplicationStatusInput,
    fromStatus: ApplicationRecord["status"]
  ): Promise<ApplicationRecord | null> {
    const application = this.applications.get(applicationId);

    if (application?.userId !== userId) {
      return Promise.resolve(null);
    }

    const updated = {
      ...application,
      status: input.status,
      notes: input.notes ?? application.notes,
      updatedAt: now
    };

    this.applications.set(applicationId, updated);
    this.history.push(historyRecord(updated, fromStatus, input.status));
    return Promise.resolve(updated);
  }

  listHistory(
    applicationId: string
  ): Promise<ApplicationStatusHistoryRecord[]> {
    return Promise.resolve(
      this.history.filter((item) => item.applicationRecordId === applicationId)
    );
  }

  seedApplication(
    userId: string,
    jobId: string,
    input: Partial<CreateApplicationInput> = {}
  ): Promise<ApplicationRecord> {
    const job = this.jobs.find((item) => item.id === jobId);

    if (!job) {
      throw new Error("Job fixture missing");
    }

    const application: ApplicationRecord = {
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${crypto.randomUUID().slice(24)}`,
      userId,
      jobListingId: jobId,
      status: input.status ?? "APPLIED",
      source: input.source ?? "MANUAL",
      notes: input.notes ?? "Applied from detail",
      appliedAt: new Date("2026-04-22T00:00:00.000Z"),
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
      updatedAt: new Date("2026-04-22T00:00:00.000Z"),
      job
    };

    this.applications.set(application.id, application);
    this.history.push(historyRecord(application, null, application.status));
    return Promise.resolve(application);
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

function historyRecord(
  application: ApplicationRecord,
  fromStatus: ApplicationRecord["status"] | null,
  toStatus: ApplicationRecord["status"]
): ApplicationStatusHistoryRecord {
  return {
    id: `history-${application.id}-${toStatus}`,
    applicationRecordId: application.id,
    userId: application.userId,
    fromStatus,
    toStatus,
    notes: application.notes,
    createdAt: now
  };
}

function matchesQuery(
  application: ApplicationRecord,
  query: ListApplicationsQueryInput
) {
  if (query.status && application.status !== query.status) {
    return false;
  }

  if (!query.keyword) {
    return true;
  }

  const searchable = [
    application.notes,
    application.job.title,
    application.job.normalizedTitle,
    application.job.description,
    application.job.requirementSummary,
    application.job.company.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(query.keyword.toLowerCase());
}

function sortApplications(
  applications: ApplicationRecord[],
  sort: ListApplicationsQueryInput["sort"]
) {
  const sorted = [...applications];

  if (sort === "created_desc") {
    return sorted.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );
  }

  if (sort === "newest") {
    return sorted.sort(
      (left, right) => right.appliedAt.getTime() - left.appliedAt.getTime()
    );
  }

  return sorted.sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
  );
}

function jobRecords(): JobRecord[] {
  return [
    baseJob({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Backend Developer",
      sourceSlug: "glints",
      sourceName: "Glints",
      companyName: "Nusantara Tech"
    }),
    baseJob({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Data Analyst",
      sourceSlug: "jobstreet",
      sourceName: "Jobstreet",
      companyName: "Data Nusantara"
    })
  ];
}

function baseJob(input: {
  id: string;
  title: string;
  sourceSlug: string;
  sourceName: string;
  companyName: string;
}): JobRecord {
  return {
    id: input.id,
    title: input.title,
    normalizedTitle: input.title.toLowerCase(),
    category: "Engineering",
    description: "Build and maintain product systems.",
    requirementSummary: "TypeScript and SQL",
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
    sourceUrl: `https://${input.sourceSlug}.example/job`,
    externalApplyUrl: `https://${input.sourceSlug}.example/apply`,
    postedAt: new Date("2026-04-20T00:00:00.000Z"),
    sourceUpdatedAt: null,
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-22T00:00:00.000Z"),
    company: {
      id: `${input.sourceSlug}-company`,
      name: input.companyName,
      logoUrl: null
    },
    sourcePlatform: {
      id: `${input.sourceSlug}-source`,
      name: input.sourceName,
      slug: input.sourceSlug
    },
    requirements: [],
    skills: []
  };
}
