import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { createApp } from "@/app";

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

function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "HTTP server shutdown requested");

  server.close((error) => {
    if (error) {
      logger.error({ error }, "HTTP server shutdown failed");
      process.exit(1);
    }

    logger.info("HTTP server stopped");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
