import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import { successResponse } from "@/core/responses/response.formatter";
import {
  createDefaultHealthDependencyChecks,
  getReadinessPayload
} from "@/modules/health/health.service";
import type { HealthDependencyChecks } from "@/modules/health/health.types";

type HealthController = {
  live: RequestHandler;
  ready: RequestHandler;
};

export function createHealthController(
  config: AppConfig,
  checks: HealthDependencyChecks = createDefaultHealthDependencyChecks(config)
): HealthController {
  return {
    live: (_req, res) => {
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
    },
    ready: async (req, res) => {
      const payload = await getReadinessPayload(config, req.requestId, checks);

      res.json(successResponse(payload, "Service is ready"));
    }
  };
}
