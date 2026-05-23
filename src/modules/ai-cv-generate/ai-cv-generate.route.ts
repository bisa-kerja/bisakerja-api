import type { Router } from "express";
import { Router as createRouter } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { PrismaAiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer";
import { AiCvGenerateController } from "@/modules/ai-cv-generate/ai-cv-generate.controller";
import { generateCvMarkdownSchema } from "@/modules/ai-cv-generate/ai-cv-generate.schema";
import type { AiCvGenerateRouterOptions } from "@/modules/ai-cv-generate/ai-cv-generate.types";
import { createModelApiClient } from "@/shared/integrations/model-api.client";

export function createAiCvGenerateRouter(
  config: AppConfig,
  options: AiCvGenerateRouterOptions = {}
): Router {
  const router = createRouter();
  const repository = options.repository ?? new PrismaAiCvAnalyzerRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const modelApiClient = options.modelApiClient ?? createModelApiClient(config);
  const controller = new AiCvGenerateController({
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
    validate({ body: generateCvMarkdownSchema }),
    controller.generateMarkdown
  );

  return router;
}
