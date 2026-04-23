import type { Express } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthRouter } from "@/modules/auth";
import { createHealthRouter } from "@/modules/health";
import { createUsersRouter } from "@/modules/users";
import type { RouteOptions } from "@/modules/route.types";
export type { RouteOptions } from "@/modules/route.types";

export function registerRoutes(
  app: Express,
  config: AppConfig,
  options: RouteOptions = {}
) {
  app.use("/health", createHealthRouter(config, options.health));
  app.use(
    `${config.app.apiPrefix}/auth`,
    createAuthRouter(config, options.auth)
  );
  app.use(
    `${config.app.apiPrefix}/me`,
    createUsersRouter(config, options.users)
  );
}
