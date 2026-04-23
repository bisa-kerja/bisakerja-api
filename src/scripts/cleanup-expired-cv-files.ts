import { env } from "@/config/env";
import {
  LocalCvFileStorage,
  PrismaAiCvAnalyzerRepository,
  cleanupExpiredCvFiles
} from "@/modules/ai-cv-analyzer";
import { prisma } from "@/shared/libs/prisma";

async function main() {
  const repository = new PrismaAiCvAnalyzerRepository();
  const storage = new LocalCvFileStorage(env.uploads.storagePath);
  const result = await cleanupExpiredCvFiles(repository, storage, new Date());

  console.info(
    JSON.stringify(
      {
        message: "Expired CV upload cleanup completed",
        ...result
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
