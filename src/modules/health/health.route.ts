import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createHealthController } from "@/modules/health/health.controller";
import { createDefaultHealthDependencyChecks } from "@/modules/health/health.service";
import type { HealthRouterOptions } from "@/modules/health/health.types";

export function createHealthRouter(
  config: AppConfig,
  options: HealthRouterOptions = {}
): Router {
  const router = Router();
  const checks = options.checks ?? createDefaultHealthDependencyChecks(config);
  const controller = createHealthController(config, checks);

  router.get("/live", controller.live);
  router.get("/ready", controller.ready);

  return router;
}
