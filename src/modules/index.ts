import type { Express } from "express";

import type { AppConfig } from "@/config/env";
import { createAiCvAnalyzerRouter } from "@/modules/ai-cv-analyzer";
import { createAiJobFitRouter } from "@/modules/ai-job-fit";
import { createAuthRouter } from "@/modules/auth";
import { createApplicationsRouter } from "@/modules/applications";
import { createBookmarksRouter } from "@/modules/bookmarks";
import { createHealthRouter } from "@/modules/health";
import { createJobsRouter } from "@/modules/jobs";
import { createPreferencesRouter } from "@/modules/preferences";
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
    `${config.app.apiPrefix}/jobs`,
    createJobsRouter(config, options.jobs)
  );
  app.use(
    `${config.app.apiPrefix}/me/preferences`,
    createPreferencesRouter(config, options.preferences)
  );
  app.use(
    `${config.app.apiPrefix}/me/bookmarks`,
    createBookmarksRouter(config, options.bookmarks)
  );
  app.use(
    `${config.app.apiPrefix}/me/applications`,
    createApplicationsRouter(config, options.applications)
  );
  app.use(
    `${config.app.apiPrefix}/ai/job-fit`,
    createAiJobFitRouter(config, options.aiJobFit)
  );
  app.use(
    `${config.app.apiPrefix}/ai/cv-analyzer`,
    createAiCvAnalyzerRouter(config, options.aiCvAnalyzer)
  );
  app.use(
    `${config.app.apiPrefix}/me`,
    createUsersRouter(config, options.users)
  );
}
