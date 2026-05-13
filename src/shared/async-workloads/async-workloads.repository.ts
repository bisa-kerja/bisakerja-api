import type { AsyncJobOutbox as PrismaAsyncJobOutbox } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type {
  AsyncJobErrorDetails,
  AsyncJobOutboxRepository,
  AsyncJobRecord,
  AsyncJobType,
  EnqueueAsyncJobInput
} from "@/shared/async-workloads/async-workloads.types";
import { parseAsyncJobPayload } from "@/shared/async-workloads/async-workloads.schema";

type PrismaClientLike = typeof prisma | PrismaTransaction;

const jobTypeToPrisma = {
  "auth.email-verification": "AUTH_EMAIL_VERIFICATION",
  "auth.password-reset": "AUTH_PASSWORD_RESET",
  "maintenance.cv-cleanup": "MAINTENANCE_CV_CLEANUP"
} as const;

const prismaToJobType = {
  AUTH_EMAIL_VERIFICATION: "auth.email-verification",
  AUTH_PASSWORD_RESET: "auth.password-reset",
  MAINTENANCE_CV_CLEANUP: "maintenance.cv-cleanup"
} as const;

export class PrismaAsyncJobOutboxRepository implements AsyncJobOutboxRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async createJob<TJobType extends AsyncJobType>(
    input: EnqueueAsyncJobInput<TJobType>
  ): Promise<AsyncJobRecord<TJobType>> {
    const record = await this.client.asyncJobOutbox.create({
      data: {
        jobType: jobTypeToPrisma[input.jobType],
        requestId: input.requestId ?? null,
        actorId: input.actorId ?? null,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        maxAttempts: input.maxAttempts,
        scheduledAt: input.scheduledAt
      }
    });

    return mapAsyncJobRecord(record) as AsyncJobRecord<TJobType>;
  }

  async findById(jobId: string): Promise<AsyncJobRecord | null> {
    const record = await this.client.asyncJobOutbox.findUnique({
      where: { id: jobId }
    });

    return record ? mapAsyncJobRecord(record) : null;
  }

  async listPendingJobs(limit: number, now: Date): Promise<AsyncJobRecord[]> {
    const records = await this.client.asyncJobOutbox.findMany({
      where: {
        scheduledAt: { lte: now },
        status: { in: ["PENDING", "QUEUED", "PROCESSING"] }
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: limit
    });

    return records.map(mapAsyncJobRecord);
  }

  async markQueued(jobId: string, publishedAt: Date): Promise<void> {
    await this.client.asyncJobOutbox.updateMany({
      where: { id: jobId, status: "PENDING" },
      data: {
        status: "QUEUED",
        publishedAt,
        lastErrorCode: null,
        lastErrorMessage: null
      }
    });
  }

  async markProcessing(
    jobId: string,
    attempt: number,
    startedAt: Date,
    processingStaleBefore: Date
  ): Promise<boolean> {
    const result = await this.client.asyncJobOutbox.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: { in: ["PENDING", "QUEUED"] } },
          {
            status: "PROCESSING",
            processingStartedAt: { lte: processingStaleBefore }
          }
        ]
      },
      data: {
        status: "PROCESSING",
        attempts: attempt,
        processingStartedAt: startedAt
      }
    });

    return result.count > 0;
  }

  async markSucceeded(
    jobId: string,
    attempt: number,
    completedAt: Date
  ): Promise<void> {
    await this.client.asyncJobOutbox.updateMany({
      where: { id: jobId, status: "PROCESSING", attempts: attempt },
      data: {
        status: "SUCCEEDED",
        completedAt
      }
    });
  }

  async markRetryableFailure(
    jobId: string,
    attempt: number,
    _failedAt: Date,
    error: AsyncJobErrorDetails
  ): Promise<void> {
    await this.client.asyncJobOutbox.updateMany({
      where: { id: jobId, status: "PROCESSING", attempts: attempt },
      data: {
        status: "QUEUED",
        attempts: attempt,
        lastErrorCode: error.code,
        lastErrorMessage: error.message
      }
    });
  }

  async markDeadLetter(
    jobId: string,
    attempt: number,
    failedAt: Date,
    error: AsyncJobErrorDetails
  ): Promise<void> {
    await this.client.asyncJobOutbox.updateMany({
      where: { id: jobId, status: "PROCESSING", attempts: attempt },
      data: {
        status: "DEAD_LETTER",
        attempts: attempt,
        deadLetteredAt: failedAt,
        lastErrorCode: error.code,
        lastErrorMessage: error.message
      }
    });
  }

  countNonTerminalJobs(): Promise<number> {
    return this.client.asyncJobOutbox.count({
      where: {
        status: {
          in: ["PENDING", "QUEUED", "PROCESSING"]
        }
      }
    });
  }
}

export function mapAsyncJobRecord(
  record: PrismaAsyncJobOutbox
): AsyncJobRecord {
  const jobType = prismaToJobType[record.jobType];

  return {
    id: record.id,
    jobType,
    status: record.status,
    requestId: record.requestId,
    actorId: record.actorId,
    idempotencyKey: record.idempotencyKey,
    payload: parseAsyncJobPayload(jobType, record.payload),
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    scheduledAt: record.scheduledAt,
    publishedAt: record.publishedAt,
    processingStartedAt: record.processingStartedAt,
    completedAt: record.completedAt,
    deadLetteredAt: record.deadLetteredAt,
    lastErrorCode: record.lastErrorCode,
    lastErrorMessage: record.lastErrorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
