import { PrismaPg } from "@prisma/adapter-pg";

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
      await prisma.$transaction([
        prisma.applicationStatusHistory.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.applicationRecord.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.bookmark.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.userPreference.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.userSkill.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.userProfile.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.authCredential.deleteMany({
          where: { user: { email: { endsWith: `-${runId}@example.test` } } }
        }),
        prisma.user.deleteMany({
          where: { email: { endsWith: `-${runId}@example.test` } }
        }),
        prisma.jobRequirement.deleteMany({
          where: { jobListing: { externalJobId: { contains: runId } } }
        }),
        prisma.jobSkill.deleteMany({
          where: { jobListing: { externalJobId: { contains: runId } } }
        }),
        prisma.jobListing.deleteMany({
          where: { externalJobId: { contains: runId } }
        }),
        prisma.company.deleteMany({
          where: { slug: { contains: runId } }
        }),
        prisma.skill.deleteMany({
          where: { slug: { contains: runId } }
        }),
        prisma.sourcePlatform.deleteMany({
          where: { slug: { contains: runId } }
        })
      ]);
      await prisma.$disconnect();
    }
  };
}

export function logRepositorySkip(reason: string) {
  console.warn(`Skipping database-backed repository assertion: ${reason}`);
}
