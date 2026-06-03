import { AppError, ServiceUnavailableError } from "@/core/errors/app.error";
import type {
  AsyncJobErrorDetails,
  AsyncJobType
} from "@/shared/async-workloads/async-workloads.types";

export function summarizeAsyncJobError(error: unknown): AsyncJobErrorDetails {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  if (error instanceof Error) {
    return {
      code: "ASYNC_JOB_RUNTIME_ERROR",
      message: error.message
    };
  }

  return {
    code: "ASYNC_JOB_RUNTIME_ERROR",
    message: "Unknown async job runtime error"
  };
}

export function toAsyncJobIdempotencyKey(
  jobType: AsyncJobType,
  fingerprint: string
) {
  return `${jobType}/${fingerprint}`;
}

export function createAsyncQueueUnavailableError(cause: unknown) {
  return new ServiceUnavailableError(
    "Async job queue is temporarily unavailable",
    "ASYNC_QUEUE_UNAVAILABLE",
    {
      cause:
        cause instanceof Error ? cause.message : "Unknown Redis queue error"
    }
  );
}
