import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { AuthController } from "@/modules/auth/auth.controller";
import { PrismaAuthRepository } from "@/modules/auth/auth.repository";
import { createAsyncJobPublisher } from "@/shared/async-workloads/async-workloads.queue";
import {
  emptyBodySchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from "@/modules/auth/auth.schema";
import type { AuthRouterOptions } from "@/modules/auth/auth.types";

export function createAuthRouter(
  config: AppConfig,
  options: AuthRouterOptions = {}
): Router {
  const router = Router();
  const { repository, jobPublisher } = resolveAuthDependencies(config, options);
  const authMiddleware =
    options.authMiddleware ?? createAuthMiddleware(config, repository);
  const controller = new AuthController({
    config,
    repository,
    jobPublisher,
    now: options.now
  });
  const { authLimiter } = createRateLimiters(config);

  router.post(
    "/register",
    authLimiter,
    validate({ body: registerSchema }),
    controller.register
  );
  router.post(
    "/login",
    authLimiter,
    validate({ body: loginSchema }),
    controller.login
  );
  router.post(
    "/refresh",
    authLimiter,
    validate({ body: emptyBodySchema }),
    controller.refresh
  );
  router.post(
    "/logout",
    authLimiter,
    authMiddleware,
    validate({ body: emptyBodySchema }),
    controller.logout
  );
  router.post(
    "/forgot-password",
    authLimiter,
    validate({ body: forgotPasswordSchema }),
    controller.forgotPassword
  );
  router.post(
    "/reset-password",
    authLimiter,
    validate({ body: resetPasswordSchema }),
    controller.resetPassword
  );
  router.post(
    "/verify-email",
    authLimiter,
    validate({ body: verifyEmailSchema }),
    controller.verifyEmail
  );
  router.post("/google", authLimiter, controller.google);

  return router;
}

function resolveAuthDependencies(
  config: AppConfig,
  options: AuthRouterOptions
) {
  return {
    repository: options.repository ?? new PrismaAuthRepository(),
    jobPublisher: options.jobPublisher ?? createAsyncJobPublisher(config)
  };
}
