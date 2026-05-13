import { describe, expect, test } from "bun:test";

import {
  ConflictError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import {
  createAsyncQueueUnavailableError,
  summarizeAsyncJobError,
  toAsyncJobIdempotencyKey
} from "@/shared/async-workloads/async-workloads.utils";

describe("async workloads utils", () => {
  test("summarizes AppError with explicit code and message", () => {
    const summary = summarizeAsyncJobError(
      new ConflictError("Konflik payload", "ASYNC_CONFLICT")
    );

    expect(summary).toEqual({
      code: "ASYNC_CONFLICT",
      message: "Konflik payload"
    });
  });

  test("summarizes generic Error as runtime error", () => {
    const summary = summarizeAsyncJobError(new Error("redis connection lost"));

    expect(summary).toEqual({
      code: "ASYNC_JOB_RUNTIME_ERROR",
      message: "redis connection lost"
    });
  });

  test("summarizes unknown value as fallback runtime error", () => {
    const summary = summarizeAsyncJobError("unknown");

    expect(summary).toEqual({
      code: "ASYNC_JOB_RUNTIME_ERROR",
      message: "Error runtime async job tidak diketahui"
    });
  });

  test("builds deterministic idempotency key", () => {
    expect(
      toAsyncJobIdempotencyKey("auth.password-reset", "user@example.com:reset")
    ).toBe("auth.password-reset/user@example.com:reset");
  });

  test("maps queue runtime failure to service unavailable error", () => {
    const failure = createAsyncQueueUnavailableError(
      new Error("socket hang up")
    );

    expect(failure).toBeInstanceOf(ServiceUnavailableError);
    expect(failure.code).toBe("ASYNC_QUEUE_UNAVAILABLE");
    expect(failure.details).toEqual({
      cause: "socket hang up"
    });
  });

  test("maps unknown queue runtime cause to fallback details", () => {
    const failure = createAsyncQueueUnavailableError(undefined);

    expect(failure).toBeInstanceOf(ServiceUnavailableError);
    expect(failure.details).toEqual({
      cause: "Error queue Redis tidak diketahui"
    });
  });
});
