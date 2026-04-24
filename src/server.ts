import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { createApp } from "@/app";
import { prisma } from "@/shared/libs/prisma";

const app = createApp(env);
const server = app.listen(env.app.port, () => {
  logger.info(
    {
      port: env.app.port,
      env: env.app.env
    },
    "HTTP server started"
  );
});

let isShuttingDown = false;

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "HTTP server shutdown requested");

  try {
    await closeServer();
    await prisma.$disconnect();

    logger.info("HTTP server stopped");
    process.exit(0);
  } catch (error) {
    logger.error({ error, signal }, "HTTP server shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
