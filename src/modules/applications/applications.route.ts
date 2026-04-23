import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { ApplicationsController } from "@/modules/applications/applications.controller";
import { PrismaApplicationsRepository } from "@/modules/applications/applications.repository";
import {
  applicationParamsSchema,
  createApplicationSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
  updateApplicationStatusSchema
} from "@/modules/applications/applications.schema";
import type { ApplicationsRouterOptions } from "@/modules/applications/applications.types";

export function createApplicationsRouter(
  config: AppConfig,
  options: ApplicationsRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaApplicationsRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const controller = new ApplicationsController({
    repository,
    config,
    now: options.now
  });

  router.use(authMiddleware);

  router.get(
    "/",
    validate({ query: listApplicationsQuerySchema }),
    controller.listApplications
  );
  router.post(
    "/",
    validate({ body: createApplicationSchema }),
    controller.createApplication
  );
  router.patch(
    "/:applicationId",
    validate({
      params: applicationParamsSchema,
      body: updateApplicationSchema
    }),
    controller.updateApplication
  );
  router.patch(
    "/:applicationId/status",
    validate({
      params: applicationParamsSchema,
      body: updateApplicationStatusSchema
    }),
    controller.updateApplicationStatus
  );

  return router;
}
