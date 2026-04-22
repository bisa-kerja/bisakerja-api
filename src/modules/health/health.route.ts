import { Router } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import type { AppConfig } from "@/config/env";

export function createHealthRouter(config: AppConfig): Router {
  const router = Router();

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

  return router;
}
