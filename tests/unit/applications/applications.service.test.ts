import { describe, expect, test } from "bun:test";

import { ApplicationsService, canTransition } from "@/modules/applications";
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

const now = new Date("2026-04-23T00:00:00.000Z");
const jobId = "11111111-1111-4111-8111-111111111111";
const applicationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("ApplicationsService", () => {
  test("returns paginated application resources using job card shape", async () => {
    const repository = new StaticApplicationsRepository([
      applicationRecord({ userId: "user-1", job: jobRecord() })
    ]);
    const service = new ApplicationsService(repository, {
      staleAfterHours: 72,
      now: () => now
    });

    const result = await service.listApplications("user-1", {
      page: 1,
      limit: 20,
      sort: "updated_desc"
    });

    expect(result).toMatchObject({
      data: [
        {
          id: applicationId,
          status: "APPLIED",
          source: "MANUAL",
          job: {
            id: jobId,
            sourcePlatform: { slug: "glints" },
            employmentType: "FULL_TIME",
            isStale: false
          },
          appliedAt: "2026-04-22T00:00:00.000Z"
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
        filters: {},
        sort: "updated_desc"
      }
    });
  });

  test("creates default applied record and rejects duplicate, missing, or invalid initial status", async () => {
    const repository = new StaticApplicationsRepository([], [jobRecord()]);
    const service = new ApplicationsService(repository, {
      staleAfterHours: 72,
      now: () => now
    });

    const created = await service.createApplication("user-1", {
      jobId,
      status: "APPLIED",
      source: "EXTERNAL_APPLY_CLICK",
      notes: "Applied externally"
    });

    expect(created).toMatchObject({
      job: { id: jobId },
      source: "EXTERNAL_APPLY_CLICK"
    });
    expect(repository.history).toHaveLength(1);

    expect.assertions(5);

    try {
      await service.createApplication("user-1", {
        jobId,
        status: "APPLIED",
        source: "MANUAL"
      });
    } catch (error) {
      expect(error).toHaveProperty("code", "APPLICATION_ALREADY_TRACKED");
    }

    try {
      await service.createApplication("user-1", {
        jobId: "99999999-9999-4999-8999-999999999999",
        status: "APPLIED",
        source: "MANUAL"
      });
    } catch (error) {
      expect(error).toHaveProperty("code", "JOB_NOT_FOUND");
    }

    try {
      await service.createApplication("user-2", {
        jobId,
        status: "INTERVIEW",
        source: "MANUAL"
      });
    } catch (error) {
      expect(error).toHaveProperty("code", "APPLICATION_STATUS_CONFLICT");
    }
  });

  test("updates metadata and status with ownership and transition checks", async () => {
    const repository = new StaticApplicationsRepository([
      applicationRecord({ userId: "user-1", job: jobRecord() })
    ]);
    const service = new ApplicationsService(repository, {
      staleAfterHours: 72,
      now: () => now
    });

    const metadata = await service.updateApplication("user-1", applicationId, {
      notes: null,
      source: "EXTERNAL_APPLY_CLICK"
    });
    const status = await service.updateApplicationStatus(
      "user-1",
      applicationId,
      { status: "INTERVIEW", notes: "First interview" }
    );

    expect(metadata).toMatchObject({
      notes: null,
      source: "EXTERNAL_APPLY_CLICK"
    });
    expect(status).toMatchObject({ status: "INTERVIEW" });
    expect(repository.history.at(-1)).toMatchObject({
      fromStatus: "APPLIED",
      toStatus: "INTERVIEW"
    });
    expect(canTransition("APPLIED", "APPLIED")).toBe(false);

    expect.assertions(6);

    try {
      await service.updateApplication("user-2", applicationId, {
        notes: "No access"
      });
    } catch (error) {
      expect(error).toHaveProperty("code", "APPLICATION_NOT_FOUND");
    }

    try {
      await service.updateApplicationStatus("user-1", applicationId, {
        status: "INTERVIEW"
      });
    } catch (error) {
      expect(error).toHaveProperty("code", "APPLICATION_STATUS_CONFLICT");
    }
  });
});

class StaticApplicationsRepository implements ApplicationsRepository {
  readonly history: ApplicationStatusHistoryRecord[] = [];
  private readonly applications = new Map<string, ApplicationRecord>();

  constructor(
    applications: ApplicationRecord[],
    private readonly jobs: JobRecord[] = applications.map(
      (application) => application.job
    )
  ) {
    for (const application of applications) {
      this.applications.set(application.id, application);
    }
  }

  listForUser(
    userId: string,
    _query: ListApplicationsQueryInput
  ): Promise<ApplicationListResult> {
    const items = [...this.applications.values()].filter(
      (application) => application.userId === userId
    );
    return Promise.resolve({ items, total: items.length });
  }

  findTrackableJobById(id: string): Promise<JobRecord | null> {
    return Promise.resolve(this.jobs.find((job) => job.id === id) ?? null);
  }

  findByUserAndJob(
    userId: string,
    id: string
  ): Promise<ApplicationRecord | null> {
    return Promise.resolve(
      [...this.applications.values()].find(
        (application) =>
          application.userId === userId && application.jobListingId === id
      ) ?? null
    );
  }

  findByIdForUser(
    userId: string,
    id: string
  ): Promise<ApplicationRecord | null> {
    const application = this.applications.get(id);
    return Promise.resolve(application?.userId === userId ? application : null);
  }

  createForUser(
    userId: string,
    input: CreateApplicationInput
  ): Promise<ApplicationRecord> {
    const job = this.jobs.find((item) => item.id === input.jobId);

    if (!job) {
      throw new Error("Job fixture missing");
    }

    const application = applicationRecord({
      userId,
      job,
      status: input.status,
      source: input.source,
      notes: input.notes ?? null
    });

    this.applications.set(application.id, application);
    this.history.push(historyRecord(application, null, input.status));
    return Promise.resolve(application);
  }

  updateForUser(
    userId: string,
    id: string,
    input: UpdateApplicationInput
  ): Promise<ApplicationRecord | null> {
    const application = this.applications.get(id);

    if (application?.userId !== userId) {
      return Promise.resolve(null);
    }

    const updated = {
      ...application,
      notes: input.notes !== undefined ? input.notes : application.notes,
      source: input.source ?? application.source,
      updatedAt: now
    };
    this.applications.set(id, updated);
    return Promise.resolve(updated);
  }

  updateStatusForUser(
    userId: string,
    id: string,
    input: UpdateApplicationStatusInput,
    fromStatus: ApplicationRecord["status"]
  ): Promise<ApplicationRecord | null> {
    const application = this.applications.get(id);

    if (application?.userId !== userId) {
      return Promise.resolve(null);
    }

    const updated = {
      ...application,
      status: input.status,
      notes: input.notes ?? application.notes,
      updatedAt: now
    };
    this.applications.set(id, updated);
    this.history.push(historyRecord(updated, fromStatus, input.status));
    return Promise.resolve(updated);
  }

  listHistory(id: string): Promise<ApplicationStatusHistoryRecord[]> {
    return Promise.resolve(
      this.history.filter((item) => item.applicationRecordId === id)
    );
  }
}

function applicationRecord(input: {
  userId: string;
  job: JobRecord;
  status?: ApplicationRecord["status"];
  source?: ApplicationRecord["source"];
  notes?: string | null;
}): ApplicationRecord {
  return {
    id: applicationId,
    userId: input.userId,
    jobListingId: input.job.id,
    status: input.status ?? "APPLIED",
    source: input.source ?? "MANUAL",
    notes: input.notes ?? "Applied from detail",
    appliedAt: new Date("2026-04-22T00:00:00.000Z"),
    createdAt: new Date("2026-04-22T00:00:00.000Z"),
    updatedAt: new Date("2026-04-22T00:00:00.000Z"),
    job: input.job
  };
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

function jobRecord(): JobRecord {
  return {
    id: jobId,
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
