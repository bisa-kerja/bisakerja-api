import { describe, expect, test } from "bun:test";

import { PrismaAsyncJobOutboxRepository } from "@/shared/async-workloads/async-workloads.repository";

const now = new Date("2026-05-08T10:00:00.000Z");

describe("PrismaAsyncJobOutboxRepository", () => {
  test("recovers queued and processing async jobs after queue/runtime loss", async () => {
    const client = new RecordingAsyncJobClient();
    const repository = new PrismaAsyncJobOutboxRepository(client.prismaLike());

    await repository.listPendingJobs(25, now);

    expect(client.findManyCalls[0]).toMatchObject({
      where: {
        status: { in: ["PENDING", "QUEUED", "PROCESSING"] },
        scheduledAt: { lte: now }
      },
      take: 25
    });
  });

  test("marks queued only while job is still pending", async () => {
    const client = new RecordingAsyncJobClient();
    const repository = new PrismaAsyncJobOutboxRepository(client.prismaLike());
    const publishedAt = new Date("2026-05-08T10:01:00.000Z");

    await repository.markQueued("job_123", publishedAt);

    expect(client.updateManyCalls).toEqual([
      {
        where: { id: "job_123", status: "PENDING" },
        data: {
          status: "QUEUED",
          publishedAt,
          lastErrorCode: null,
          lastErrorMessage: null
        }
      }
    ]);
  });

  test("claims processing only from queued or stale processing states", async () => {
    const client = new RecordingAsyncJobClient();
    const repository = new PrismaAsyncJobOutboxRepository(client.prismaLike());
    const startedAt = new Date("2026-05-08T10:02:00.000Z");
    const staleBefore = new Date("2026-05-08T09:02:00.000Z");

    const claimed = await repository.markProcessing(
      "job_123",
      2,
      startedAt,
      staleBefore
    );

    expect(claimed).toBe(true);
    expect(client.updateManyCalls[0]).toEqual({
      where: {
        id: "job_123",
        OR: [
          { status: { in: ["PENDING", "QUEUED"] } },
          {
            status: "PROCESSING",
            processingStartedAt: { lte: staleBefore }
          }
        ]
      },
      data: {
        status: "PROCESSING",
        attempts: 2,
        processingStartedAt: startedAt
      }
    });
  });

  test("terminal updates are guarded by processing status and attempt", async () => {
    const client = new RecordingAsyncJobClient();
    const repository = new PrismaAsyncJobOutboxRepository(client.prismaLike());
    const completedAt = new Date("2026-05-08T10:03:00.000Z");

    await repository.markSucceeded("job_123", 3, completedAt);

    expect(client.updateManyCalls[0]).toEqual({
      where: { id: "job_123", status: "PROCESSING", attempts: 3 },
      data: {
        status: "SUCCEEDED",
        completedAt
      }
    });
  });
});

class RecordingAsyncJobClient {
  readonly findManyCalls: unknown[] = [];
  readonly updateManyCalls: unknown[] = [];
  updateManyCount = 1;

  prismaLike() {
    return {
      asyncJobOutbox: {
        findMany: (input: unknown) => {
          this.findManyCalls.push(input);
          return Promise.resolve([]);
        },
        updateMany: (input: unknown) => {
          this.updateManyCalls.push(input);
          return Promise.resolve({ count: this.updateManyCount });
        }
      }
    } as never;
  }
}
