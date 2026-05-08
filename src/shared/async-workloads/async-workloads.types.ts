import type { JobsOptions } from "bullmq";

import type { AppConfig } from "@/config/env";

import type {
  asyncJobStatuses,
  asyncJobTypes
} from "@/shared/async-workloads/async-workloads.constants";

export type AsyncJobType = (typeof asyncJobTypes)[number];
export type AsyncJobStatus = (typeof asyncJobStatuses)[number];

export type AuthEmailVerificationJobPayload = {
  email: string;
  otp: string;
  expiresAt: string;
};

export type AuthPasswordResetJobPayload = {
  email: string;
  token: string;
  expiresAt: string;
};

export type CvCleanupJobPayload = {
  triggeredAt: string;
};

export type AsyncJobPayloadMap = {
  "auth.email-verification": AuthEmailVerificationJobPayload;
  "auth.password-reset": AuthPasswordResetJobPayload;
  "maintenance.cv-cleanup": CvCleanupJobPayload;
};

export type EnqueueAsyncJobInput<TJobType extends AsyncJobType> = {
  jobType: TJobType;
  requestId?: string | null;
  actorId?: string | null;
  idempotencyKey: string;
  payload: AsyncJobPayloadMap[TJobType];
  scheduledAt?: Date;
  maxAttempts?: number;
};

export type AsyncJobRecord<TJobType extends AsyncJobType = AsyncJobType> = {
  id: string;
  jobType: TJobType;
  status: AsyncJobStatus;
  requestId: string | null;
  actorId: string | null;
  idempotencyKey: string;
  payload: AsyncJobPayloadMap[TJobType];
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  publishedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  deadLetteredAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AsyncJobErrorDetails = {
  code: string;
  message: string;
};

export type AsyncJobOutboxRepository = {
  createJob<TJobType extends AsyncJobType>(
    input: EnqueueAsyncJobInput<TJobType>
  ): Promise<AsyncJobRecord<TJobType>>;
  findById(jobId: string): Promise<AsyncJobRecord | null>;
  listPendingJobs(limit: number, now: Date): Promise<AsyncJobRecord[]>;
  markQueued(jobId: string, publishedAt: Date): Promise<void>;
  markProcessing(
    jobId: string,
    attempt: number,
    startedAt: Date,
    processingStaleBefore: Date
  ): Promise<boolean>;
  markSucceeded(
    jobId: string,
    attempt: number,
    completedAt: Date
  ): Promise<void>;
  markRetryableFailure(
    jobId: string,
    attempt: number,
    failedAt: Date,
    error: AsyncJobErrorDetails
  ): Promise<void>;
  markDeadLetter(
    jobId: string,
    attempt: number,
    failedAt: Date,
    error: AsyncJobErrorDetails
  ): Promise<void>;
  countNonTerminalJobs(): Promise<number>;
};

export type AsyncJobPublisher = {
  publish(jobId: string): Promise<void>;
  publishPending(limit?: number): Promise<number>;
  close(): Promise<void>;
};

export type AsyncJobProcessorDependencies = {
  config: AppConfig;
  now?: () => Date;
};

export type AsyncJobProcessor = {
  process(job: AsyncJobRecord): Promise<void>;
};

export type AsyncQueueJobData = {
  outboxJobId: string;
};

export type AsyncQueueRuntime = {
  publisher: AsyncJobPublisher;
  worker: {
    start(): Promise<void>;
    close(): Promise<void>;
  };
};

export type AsyncQueueAddOptions = Pick<
  JobsOptions,
  "attempts" | "backoff" | "jobId" | "removeOnComplete" | "removeOnFail"
>;
