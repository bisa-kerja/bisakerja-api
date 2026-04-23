import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { successResponse } from "@/core/responses/response.formatter";
import {
  defaultHealthDependencyChecks,
  getReadinessPayload
} from "@/modules/health/health.service";
import type { HealthRouterOptions } from "@/modules/health/health.types";

export function createHealthRouter(
  config: AppConfig,
  options: HealthRouterOptions = {}
): Router {
  const router = Router();
  const checks = options.checks ?? defaultHealthDependencyChecks;

  router.get("/live", (_req, res) => {
    res.json(
      successResponse(
        {
          service: config.app.name,
          status: "live",
          env: config.app.env
        },
        "Service is live"
      )
    );
  });

  router.get("/ready", async (req, res) => {
    const payload = await getReadinessPayload(config, req.requestId, checks);

    res.json(successResponse(payload, "Service is ready"));
  });

  return router;
}
