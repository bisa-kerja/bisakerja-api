import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { validate } from "@/core/middlewares/validate.middleware";
import { JobsController } from "@/modules/jobs/jobs.controller";
import { PrismaJobsRepository } from "@/modules/jobs/jobs.repository";
import {
  jobParamsSchema,
  listJobsQuerySchema
} from "@/modules/jobs/jobs.schema";
import type { JobsRouterOptions } from "@/modules/jobs/jobs.types";

export function createJobsRouter(
  config: AppConfig,
  options: JobsRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaJobsRepository();
  const controller = new JobsController({
    repository,
    config,
    now: options.now
  });

  router.get(
    "/",
    validate({ query: listJobsQuerySchema }),
    controller.listJobs
  );
  router.get(
    "/:jobId",
    validate({ params: jobParamsSchema }),
    controller.getJobDetail
  );

  return router;
}
