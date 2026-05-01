import { Queue, Worker } from "bullmq";

import { logger } from "@/config/logger";
import type { AppConfig } from "@/config/env";
import { createAsyncJobProcessor } from "@/shared/async-workloads/async-workloads.handlers";
import { PrismaAsyncJobOutboxRepository } from "@/shared/async-workloads/async-workloads.repository";
import type {
  AsyncJobOutboxRepository,
  AsyncJobPublisher,
  AsyncQueueAddOptions,
  AsyncQueueJobData
} from "@/shared/async-workloads/async-workloads.types";
import {
  createAsyncQueueUnavailableError,
  summarizeAsyncJobError
} from "@/shared/async-workloads/async-workloads.utils";
import {
  createBullMqConnection,
  createRedisHealthClient
} from "@/shared/libs/redis";

export function createAsyncJobPublisher(
  config: AppConfig,
  repository: AsyncJobOutboxRepository = new PrismaAsyncJobOutboxRepository()
): AsyncJobPublisher {
  return new BullMqAsyncJobPublisher(config, repository);
}

export function createAsyncJobWorker(config: AppConfig) {
  return new BullMqAsyncJobWorker(config);
}

class BullMqAsyncJobPublisher implements AsyncJobPublisher {
  private readonly repository: AsyncJobOutboxRepository;
  private readonly queue: Queue<AsyncQueueJobData>;

  constructor(
    private readonly config: AppConfig,
    repository: AsyncJobOutboxRepository
  ) {
    this.repository = repository;
    this.queue = new Queue<AsyncQueueJobData>(config.asyncWorkloads.queueName, {
      prefix: config.asyncWorkloads.queuePrefix,
      connection: createBullMqConnection(config)
    });
  }

  async publish(jobId: string): Promise<void> {
    const record = await this.repository.findById(jobId);

    if (
      !record ||
      record.status === "SUCCEEDED" ||
      record.status === "DEAD_LETTER"
    ) {
      return;
    }

    try {
      await this.queue.add(
        record.jobType,
        { outboxJobId: record.id },
        buildQueueAddOptions(this.config, record)
      );
      await this.repository.markQueued(record.id, new Date());
    } catch (error) {
      throw createAsyncQueueUnavailableError(error);
    }
  }

  async publishPending(
    limit: number = this.config.asyncWorkloads.recoveryBatchSize
  ): Promise<number> {
    const jobs = await this.repository.listPendingJobs(limit, new Date());

    for (const job of jobs) {
      await this.publish(job.id);
    }

    return jobs.length;
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

class BullMqAsyncJobWorker {
  private readonly repository: PrismaAsyncJobOutboxRepository;
  private readonly publisher: AsyncJobPublisher;
  private readonly processor;
  private readonly worker: Worker<AsyncQueueJobData>;
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: AppConfig) {
    this.repository = new PrismaAsyncJobOutboxRepository();
    this.publisher = createAsyncJobPublisher(config, this.repository);
    this.processor = createAsyncJobProcessor({ config });
    this.worker = new Worker<AsyncQueueJobData>(
      config.asyncWorkloads.queueName,
      async (job) => {
        const record = await this.repository.findById(job.data.outboxJobId);

        if (
          !record ||
          record.status === "SUCCEEDED" ||
          record.status === "DEAD_LETTER"
        ) {
          return;
        }

        const attempt = job.attemptsMade + 1;
        await this.repository.markProcessing(record.id, attempt, new Date());

        try {
          await this.processor.process(record);
          await this.repository.markSucceeded(record.id, new Date());
        } catch (error) {
          const summary = summarizeAsyncJobError(error);

          if (attempt >= record.maxAttempts) {
            await this.repository.markDeadLetter(
              record.id,
              attempt,
              new Date(),
              summary
            );
          } else {
            await this.repository.markRetryableFailure(
              record.id,
              attempt,
              new Date(),
              summary
            );
          }

          throw error;
        }
      },
      {
        prefix: config.asyncWorkloads.queuePrefix,
        connection: createBullMqConnection(config),
        concurrency: config.asyncWorkloads.workerConcurrency
      }
    );
  }

  async start(): Promise<void> {
    const recovered = await this.publisher.publishPending();
    logger.info({ recovered }, "Async worker recovery publish completed");

    this.recoveryTimer = setInterval(() => {
      void this.publisher.publishPending().catch((error: unknown) => {
        logger.warn(
          {
            error,
            component: "async-worker-recovery"
          },
          "Async worker recovery publish failed"
        );
      });
    }, this.config.asyncWorkloads.recoveryIntervalMs);

    this.recoveryTimer.unref();
    createRedisHealthClient(this.config);
  }

  async close(): Promise<void> {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    await this.worker.close();
    await this.publisher.close();
  }
}

function buildQueueAddOptions(
  config: AppConfig,
  record: {
    id: string;
    maxAttempts: number;
  }
): AsyncQueueAddOptions {
  return {
    jobId: record.id,
    attempts: record.maxAttempts,
    backoff: {
      type: "fixed",
      delay: config.asyncWorkloads.backoffMs
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000
    },
    removeOnFail: false
  };
}
