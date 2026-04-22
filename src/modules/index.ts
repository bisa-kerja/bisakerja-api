import type { Express } from "express";

import type { AppConfig } from "@/config/env";
import { createHealthRouter } from "@/modules/health";

export function registerRoutes(app: Express, config: AppConfig) {
  app.use("/health", createHealthRouter(config));
}
