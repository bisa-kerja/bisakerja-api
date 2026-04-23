import type { Express } from "express";

import type { AppConfig } from "@/config/env";
import { createHealthRouter } from "@/modules/health";
import type { HealthRouterOptions } from "@/modules/health/health.route";

export type RouteOptions = {
  health?: HealthRouterOptions;
};

export function registerRoutes(
  app: Express,
  config: AppConfig,
  options: RouteOptions = {}
) {
  app.use("/health", createHealthRouter(config, options.health));
}
