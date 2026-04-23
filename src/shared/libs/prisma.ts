import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { PrismaClient } from "@/generated/prisma/client";
export type { PrismaTransaction } from "@/shared/libs/prisma.types";

const prismaLogLevels =
  env.database.prismaLogLevel === "query"
    ? (["query", "warn", "error"] as const)
    : ([env.database.prismaLogLevel] as const);

const adapter = new PrismaPg({
  connectionString: env.database.url
});

export const prisma = new PrismaClient({
  adapter,
  log: prismaLogLevels.map((level) => ({
    emit: "event",
    level
  }))
});

prisma.$on("query", (event) => {
  logger.debug(
    {
      durationMs: event.duration,
      target: event.target
    },
    "Prisma query executed"
  );
});

prisma.$on("warn", (event) => {
  logger.warn(
    { message: event.message, target: event.target },
    "Prisma warning"
  );
});

prisma.$on("error", (event) => {
  logger.error(
    { message: event.message, target: event.target },
    "Prisma error"
  );
});
