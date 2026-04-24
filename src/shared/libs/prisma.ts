import { PrismaPg } from "@prisma/adapter-pg";

import { loadEnv } from "@/config/env";
import { createLogger } from "@/config/logger";
import { PrismaClient } from "@/generated/prisma/client";
export type { PrismaTransaction } from "@/shared/libs/prisma.types";

const prismaEnv = loadEnv();
const prismaLogger = createLogger(prismaEnv);

const prismaLogLevels =
  prismaEnv.database.prismaLogLevel === "query"
    ? (["query", "warn", "error"] as const)
    : ([prismaEnv.database.prismaLogLevel] as const);

const adapter = new PrismaPg({
  connectionString: prismaEnv.database.url
});

export const prisma = new PrismaClient({
  adapter,
  log: prismaLogLevels.map((level) => ({
    emit: "event",
    level
  }))
});

prisma.$on("query", (event) => {
  prismaLogger.debug(
    {
      durationMs: event.duration,
      target: event.target
    },
    "Prisma query executed"
  );
});

prisma.$on("warn", (event) => {
  prismaLogger.warn(
    { message: event.message, target: event.target },
    "Prisma warning"
  );
});

prisma.$on("error", (event) => {
  prismaLogger.error(
    { message: event.message, target: event.target },
    "Prisma error"
  );
});
