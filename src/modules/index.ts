import type { Express } from "express";

import type { AppConfig } from "@/config/env";
import { createHealthRouter } from "@/modules/health";
import type { RouteOptions } from "@/modules/route.types";
export type { RouteOptions } from "@/modules/route.types";

export function registerRoutes(
  app: Express,
  config: AppConfig,
  options: RouteOptions = {}
) {
  app.use("/health", createHealthRouter(config, options.health));
}
