import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { AiJobRecommendationsController } from "@/modules/ai-job-recommendations/ai-job-recommendations.controller";
import { PrismaAiJobRecommendationsRepository } from "@/modules/ai-job-recommendations/ai-job-recommendations.repository";
import {
  generateJobRecommendationsSchema,
  getJobRecommendationsQuerySchema,
  jobRecommendationRunParamsSchema
} from "@/modules/ai-job-recommendations/ai-job-recommendations.schema";
import type { AiJobRecommendationsRouterOptions } from "@/modules/ai-job-recommendations/ai-job-recommendations.types";
import { createModelApiClient } from "@/shared/integrations/model-api.client";

export function createAiJobRecommendationsRouter(
  config: AppConfig,
  options: AiJobRecommendationsRouterOptions = {}
): Router {
  const router = Router();
  const repository =
    options.repository ?? new PrismaAiJobRecommendationsRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const modelApiClient = options.modelApiClient ?? createModelApiClient(config);
  const controller = new AiJobRecommendationsController({
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
    validate({ body: generateJobRecommendationsSchema }),
    controller.generateRecommendations
  );
  router.get(
    "/latest",
    validate({ query: getJobRecommendationsQuerySchema }),
    controller.getLatestRecommendations
  );
  router.get(
    "/:recommendationRunId",
    validate({
      params: jobRecommendationRunParamsSchema,
      query: getJobRecommendationsQuerySchema
    }),
    controller.getRecommendationRunDetail
  );

  return router;
}
