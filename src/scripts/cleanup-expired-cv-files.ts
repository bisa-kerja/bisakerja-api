import { env } from "@/config/env";
import { createAsyncJobPublisher } from "@/shared/async-workloads/async-workloads.queue";
import { PrismaAsyncJobOutboxRepository } from "@/shared/async-workloads/async-workloads.repository";
import { toAsyncJobIdempotencyKey } from "@/shared/async-workloads/async-workloads.utils";
import { prisma } from "@/shared/libs/prisma";

async function main() {
  const repository = new PrismaAsyncJobOutboxRepository();
  const publisher = createAsyncJobPublisher(env, repository);
  const now = new Date();
  const minuteBucket = now.toISOString().slice(0, 16);
  const job = await repository.createJob({
    jobType: "maintenance.cv-cleanup",
    requestId: "system.cleanup-expired-cv-files",
    actorId: null,
    idempotencyKey: toAsyncJobIdempotencyKey(
      "maintenance.cv-cleanup",
      minuteBucket
    ),
    payload: {
      triggeredAt: now.toISOString()
    },
    maxAttempts: env.asyncWorkloads.maxAttempts
  });
  await publisher.publish(job.id);

  console.info(
    JSON.stringify(
      {
        message: "Expired CV upload cleanup queued",
        jobId: job.id
      },
      null,
      2
    )
  );
  await publisher.close();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
