import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { validate } from "@/core/middlewares/validate.middleware";
import { InternalController } from "@/modules/internal/internal.controller";
import { createInternalServiceAuthMiddleware } from "@/modules/internal/internal.middleware";
import { PrismaInternalRepository } from "@/modules/internal/internal.repository";
import {
  notificationEventsSchema,
  scraperJobsSyncSchema
} from "@/modules/internal/internal.schema";
import type { InternalRouterOptions } from "@/modules/internal/internal.types";

export function createInternalRouter(
  config: AppConfig,
  options: InternalRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaInternalRepository();
  const authMiddleware =
    options.authMiddleware ?? createInternalServiceAuthMiddleware(config);
  const controller = new InternalController({
    repository,
    config
  });

  router.use(authMiddleware);
  router.post(
    "/scraper/jobs",
    validate({ body: scraperJobsSyncSchema }),
    controller.syncScraperJobs
  );
  router.post(
    "/notification-events",
    validate({ body: notificationEventsSchema }),
    controller.acceptNotificationEvents
  );

  return router;
}
