import type { Router } from "express";
import { Router as createRouter } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { PrismaAiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer";
import { createAiCvGenerateGenAiClient } from "@/modules/ai-cv-generate/ai-cv-generate.genai";
import { AiCvGenerateController } from "@/modules/ai-cv-generate/ai-cv-generate.controller";
import { generateCvMarkdownSchema } from "@/modules/ai-cv-generate/ai-cv-generate.schema";
import type { AiCvGenerateRouterOptions } from "@/modules/ai-cv-generate/ai-cv-generate.types";
import { LocalCvFileStorage } from "@/modules/ai-cv-analyzer";

export function createAiCvGenerateRouter(
  config: AppConfig,
  options: AiCvGenerateRouterOptions = {}
): Router {
  const router = createRouter();
  const repository = options.repository ?? new PrismaAiCvAnalyzerRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const storage =
    options.storage ?? new LocalCvFileStorage(config.uploads.storagePath);
  const genAiClient =
    options.genAiClient ??
    (config.integrations.aiCvGenerateGenAi.enabled
      ? createAiCvGenerateGenAiClient(config)
      : undefined);
  const controller = new AiCvGenerateController({
    repository,
    config,
    storage,
    genAiClient,
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
