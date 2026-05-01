import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { createAsyncJobWorker } from "@/shared/async-workloads/async-workloads.queue";
import { prisma } from "@/shared/libs/prisma";
import { closeRedisHealthClient } from "@/shared/libs/redis";

const worker = createAsyncJobWorker(env);

let isShuttingDown = false;

async function start() {
  await worker.start();
  logger.info(
    {
      queueName: env.asyncWorkloads.queueName,
      concurrency: env.asyncWorkloads.workerConcurrency
    },
    "Async worker started"
  );
}

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Async worker shutdown requested");

  try {
    await worker.close();
    await closeRedisHealthClient();
    await prisma.$disconnect();
    logger.info("Async worker stopped");
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, "Async worker shutdown failed");
    process.exit(1);
  }
}

start().catch(async (error: unknown) => {
  logger.error({ error }, "Async worker failed to start");
  await closeRedisHealthClient();
  await prisma.$disconnect();
  process.exit(1);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
