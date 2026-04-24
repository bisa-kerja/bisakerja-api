import { PrismaPg } from "@prisma/adapter-pg";
import { createConnection } from "node:net";

import { PrismaClient } from "@/generated/prisma/client";
import { assertIntegrationTestEnvironment } from "./test-environment";
import { testConfig } from "./config";

export type RepositoryTestContext = {
  prisma: PrismaClient;
  runId: string;
  cleanup: () => Promise<void>;
};

export async function createRepositoryTestContext() {
  if (process.env.RUN_DATABASE_TESTS !== "true") {
    return {
      skipped: true as const,
      reason: "Set RUN_DATABASE_TESTS=true to run database-backed assertions."
    };
  }

  const config = testConfig();
  const databaseUrl = config.database.runtimeUrl;

  try {
    assertIntegrationTestEnvironment(config, { databaseUrl });
  } catch (error) {
    return {
      skipped: true as const,
      reason: error instanceof Error ? error.message : "Invalid test database."
    };
  }

  if (!(await canReachDatabase(databaseUrl))) {
    return {
      skipped: true as const,
      reason: "Database TCP port is unavailable."
    };
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl })
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    await prisma.$disconnect();
    return {
      skipped: true as const,
      reason:
        error instanceof Error
          ? `Database unavailable: ${error.message}`
          : "Database unavailable."
    };
  }

  try {
    const schemaStatus = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'source_platforms', 'job_listings')
    `;
    const availableTables = new Set(schemaStatus.map((row) => row.table_name));
    const requiredTables = ["users", "source_platforms", "job_listings"];

    if (!requiredTables.every((tableName) => availableTables.has(tableName))) {
      await prisma.$disconnect();
      return {
        skipped: true as const,
        reason:
          "Database is reachable but Prisma migrations have not been applied."
      };
    }
  } catch (error) {
    await prisma.$disconnect();
    return {
      skipped: true as const,
      reason:
        error instanceof Error
          ? `Database schema check failed: ${error.message}`
          : "Database schema check failed."
    };
  }

  const runId = crypto.randomUUID();

  return {
    skipped: false as const,
    prisma,
    runId,
    cleanup: async () => {
      await prisma.fitScoreResult.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.skillGapResult.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.cvAnalysisResult.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.cvFileMetadata.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.applicationStatusHistory.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.applicationRecord.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.bookmark.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.userPreference.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.userSkill.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.userProfile.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.authCredential.deleteMany({
        where: { user: { email: { endsWith: `-${runId}@example.test` } } }
      });
      await prisma.user.deleteMany({
        where: { email: { endsWith: `-${runId}@example.test` } }
      });
      await prisma.jobRequirement.deleteMany({
        where: { jobListing: { externalJobId: { contains: runId } } }
      });
      await prisma.jobSkill.deleteMany({
        where: { jobListing: { externalJobId: { contains: runId } } }
      });
      await prisma.jobListing.deleteMany({
        where: { externalJobId: { contains: runId } }
      });
      await prisma.company.deleteMany({
        where: { slug: { contains: runId } }
      });
      await prisma.skill.deleteMany({
        where: { slug: { contains: runId } }
      });
      await prisma.sourcePlatform.deleteMany({
        where: { slug: { contains: runId } }
      });
      await prisma.$disconnect();
    }
  };
}

export function logRepositorySkip(reason: string) {
  console.warn(`Skipping database-backed repository assertion: ${reason}`);
}

async function canReachDatabase(databaseUrl: string): Promise<boolean> {
  const url = new URL(databaseUrl);
  const port = Number(url.port || "5432");

  return new Promise((resolve) => {
    const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (reachable: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(300);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}
