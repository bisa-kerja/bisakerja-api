import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import type {
  NotificationEventsInput,
  ScraperJobsSyncInput
} from "@/modules/internal/internal.schema";
import type {
  InternalRepository,
  NotificationEventsResult,
  ScraperJobsSyncResult
} from "@/modules/internal/internal.types";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("internal routes", () => {
  test("syncs scraper jobs with service token auth", async () => {
    const context = createInternalRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/internal/scraper/jobs",
      headers: {
        authorization: "Bearer test-scraper-service-token",
        "x-request-id": "req_internal_sync"
      },
      body: scraperJobsPayload()
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Lowongan dari scraper berhasil disinkronkan",
      data: {
        accepted: 1,
        upserted: 1,
        jobs: [
          {
            externalJobId: "scraper-job-1",
            sourcePlatform: "glints",
            jobId: "job-1",
            action: "created"
          }
        ]
      }
    });
    const syncedJob = context.repository.syncInput?.jobs.at(0);
    expect(syncedJob?.jobListing.title).toBe("Backend Developer");
  });

  test("rejects missing service token", async () => {
    const context = createInternalRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/internal/scraper/jobs",
      headers: { "x-request-id": "req_internal_no_token" },
      body: scraperJobsPayload()
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_internal_no_token"
      }
    });
    expect(context.repository.syncInput).toBeNull();
  });

  test("validates sync payload before repository call", async () => {
    const context = createInternalRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/internal/scraper/jobs",
      headers: {
        authorization: "Bearer test-scraper-service-token",
        "x-request-id": "req_internal_bad_payload"
      },
      body: { jobs: [] }
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        requestId: "req_internal_bad_payload"
      }
    });
    expect(response.body).toMatchObject({
      error: {
        details: [expect.objectContaining({ path: "jobs" })]
      }
    });
    expect(context.repository.syncInput).toBeNull();
  });

  test("accepts notification handoff events", async () => {
    const context = createInternalRouteContext();

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/internal/notification-events",
      headers: {
        authorization: "Bearer test-scraper-service-token",
        "x-request-id": "req_internal_notifications"
      },
      body: notificationEventsPayload()
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Event notifikasi diterima",
      data: {
        accepted: 1,
        runId: "run-1"
      }
    });
    const candidate = context.repository.notificationInput?.candidates.at(0);
    expect(candidate?.eventId).toBe("event-1");
  });
});

function createInternalRouteContext() {
  const repository = new InMemoryInternalRepository();
  const app = createApp(testConfig(), {
    routes: {
      internal: { repository }
    }
  });

  return { app, repository };
}

class InMemoryInternalRepository implements InternalRepository {
  syncInput: ScraperJobsSyncInput | null = null;
  notificationInput: NotificationEventsInput | null = null;

  syncScraperJobs(input: ScraperJobsSyncInput): Promise<ScraperJobsSyncResult> {
    this.syncInput = input;

    return Promise.resolve({
      accepted: input.jobs.length,
      upserted: input.jobs.length,
      jobs: input.jobs.map((job) => ({
        externalJobId: job.jobListing.externalJobId,
        sourcePlatform: job.sourcePlatform.slug,
        jobId: "job-1",
        action: "created"
      }))
    });
  }

  acceptNotificationEvents(
    input: NotificationEventsInput
  ): Promise<NotificationEventsResult> {
    this.notificationInput = input;

    return Promise.resolve({
      accepted: input.candidates.length,
      runId: input.runId
    });
  }
}

function scraperJobsPayload() {
  return {
    jobs: [
      {
        sourcePlatform: { slug: "glints", name: "Glints" },
        company: {
          name: "Nusantara Tech",
          sourceCompanyId: null,
          sourceSlug: "nusantara-tech",
          logoUrl: null,
          websiteUrl: "https://example.test",
          industry: null
        },
        ingestionRun: { sourceRunId: "run-1" },
        jobListing: {
          externalJobId: "scraper-job-1",
          title: "Backend Developer",
          normalizedTitle: "backend developer",
          category: "Engineering",
          description: "Build APIs.",
          requirementSummary: "TypeScript",
          workType: "REMOTE",
          employmentType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          locationDisplay: "Jakarta Selatan",
          province: "DKI Jakarta",
          city: "Jakarta Selatan",
          salaryMin: 5_000_000,
          salaryMax: 10_000_000,
          salaryCurrency: "IDR",
          salaryPeriod: "MONTHLY",
          salaryDisplay: "Rp5.000.000 - Rp10.000.000 / bulan",
          sourceUrl: "https://glints.example/job",
          externalApplyUrl: "https://glints.example/apply",
          sourcePostedAt: "2026-04-20T00:00:00.000Z",
          sourceUpdatedAt: null,
          lastSeenAt: "2026-05-05T00:00:00.000Z",
          status: "ACTIVE"
        },
        requirements: [
          {
            type: "SKILL",
            value: "TypeScript",
            priority: "HIGH",
            confidence: 0.9,
            source: "ai"
          }
        ],
        skills: [{ name: "TypeScript", confidence: 0.9, source: "ai" }]
      }
    ]
  };
}

function notificationEventsPayload() {
  return {
    runId: "run-1",
    candidates: [
      {
        eventId: "event-1",
        syncEventId: "sync-1",
        sourcePlatform: "glints",
        externalJobId: "scraper-job-1",
        title: "Backend Developer",
        companyName: "Nusantara Tech",
        sourceUrl: "https://glints.example/job",
        location: { display: "Jakarta Selatan" },
        salary: { min_amount: 5_000_000 },
        status: "active",
        lastSeenAt: "2026-05-05T00:00:00.000Z"
      }
    ]
  };
}
