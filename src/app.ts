import express from "express";

import { env } from "@/config/env";
import type { AppConfig } from "@/config/env";
import { NotFoundError } from "@/core/errors/app.error";
import { errorHandler } from "@/core/errors/error.handler";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { requestLoggingMiddleware } from "@/core/middlewares/request-logging.middleware";
import {
  corsMiddleware,
  securityHeadersMiddleware
} from "@/core/middlewares/security.middleware";
import { registerRoutes } from "@/modules";

export function createApp(config: AppConfig = env) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.security.trustProxy);

  app.use(requestIdMiddleware(config));
  app.use(securityHeadersMiddleware());
  app.use(corsMiddleware(config));
  app.use(express.json({ limit: config.security.requestBodyLimit }));
  app.use(
    express.urlencoded({
      extended: false,
      limit: config.security.requestBodyLimit
    })
  );

  const rateLimiters = createRateLimiters(config);
  app.use(rateLimiters.defaultLimiter);

  if (config.observability.enableRequestLogging) {
    app.use(requestLoggingMiddleware());
  }

  registerRoutes(app, config);

  app.use((_req, _res, next) => {
    next(new NotFoundError("Route not found"));
  });

  app.use(errorHandler);

  return app;
}
