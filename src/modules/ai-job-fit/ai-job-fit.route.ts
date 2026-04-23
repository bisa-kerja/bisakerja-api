import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { AiJobFitController } from "@/modules/ai-job-fit/ai-job-fit.controller";
import { PrismaAiJobFitRepository } from "@/modules/ai-job-fit/ai-job-fit.repository";
import { analyzeJobFitSchema } from "@/modules/ai-job-fit/ai-job-fit.schema";
import type { AiJobFitRouterOptions } from "@/modules/ai-job-fit/ai-job-fit.types";
import { createModelApiClient } from "@/shared/integrations/model-api.client";

export function createAiJobFitRouter(
  config: AppConfig,
  options: AiJobFitRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaAiJobFitRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const modelApiClient = options.modelApiClient ?? createModelApiClient(config);
  const controller = new AiJobFitController({
    repository,
    config,
    modelApiClient,
    now: options.now
  });
  const { aiLimiter } = createRateLimiters(config);

  router.use(authMiddleware);
  router.post(
    "/",
    aiLimiter,
    validate({ body: analyzeJobFitSchema }),
    controller.analyzeJobFit
  );

  return router;
}
