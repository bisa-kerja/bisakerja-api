import { describe, test } from "bun:test";

import { createAsyncJobProcessor } from "@/shared/async-workloads/async-workloads.handlers";
import type { AsyncJobRecord } from "@/shared/async-workloads/async-workloads.types";
import { testConfig } from "../../helpers/config";

describe("async workloads handlers", () => {
  test("processes auth email verification jobs through configured provider", async () => {
    const processor = createAsyncJobProcessor({
      config: testConfig({
        EMAIL_PROVIDER: "fake"
      })
    });

    await processor.process(
      createJob("auth.email-verification", {
        email: "user@example.com",
        otp: "123456",
        expiresAt: "2026-05-13T10:00:00.000Z"
      })
    );
  });

  test("processes auth password reset jobs through configured provider", async () => {
    const processor = createAsyncJobProcessor({
      config: testConfig({
        EMAIL_PROVIDER: "fake"
      })
    });

    await processor.process(
      createJob("auth.password-reset", {
        email: "user@example.com",
        token: "reset-token",
        expiresAt: "2026-05-13T10:00:00.000Z"
      })
    );
  });
});

function createJob(
  jobType: AsyncJobRecord["jobType"],
  payload: unknown
): AsyncJobRecord {
  const now = new Date("2026-05-13T10:00:00.000Z");

  return {
    id: "job_123",
    jobType,
    status: "QUEUED",
    requestId: null,
    actorId: null,
    idempotencyKey: "test-key",
    payload: payload as AsyncJobRecord["payload"],
    attempts: 0,
    maxAttempts: 3,
    scheduledAt: now,
    publishedAt: now,
    processingStartedAt: null,
    completedAt: null,
    deadLetteredAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: now,
    updatedAt: now
  };
}
