import type { Express } from "express";
import type { Router } from "express";

import type { AppConfig } from "@/config/env";
import {
  createAiCvAnalyzerRouter,
  createCurrentUserCvFilesRouter
} from "@/modules/ai-cv-analyzer";
import { createAiCvGenerateRouter } from "@/modules/ai-cv-generate";
import { createAuthRouter } from "@/modules/auth";
import { createApplicationsRouter } from "@/modules/applications";
import { createBookmarksRouter } from "@/modules/bookmarks";
import { createHealthRouter } from "@/modules/health";
import { createInternalRouter } from "@/modules/internal";
import { createJobsRouter } from "@/modules/jobs";
import { createPreferencesRouter } from "@/modules/preferences";
import { createUsersRouter } from "@/modules/users";
import type { RouteOptions } from "@/modules/route.types";
export type { RouteOptions } from "@/modules/route.types";

export type MountedRouter = {
  id: string;
  mountPath: string;
  router: Router;
};

export function getMountedRouters(
  config: AppConfig,
  options: RouteOptions = {}
): MountedRouter[] {
  return [
    {
      id: "health",
      mountPath: "/health",
      router: createHealthRouter(config, options.health)
    },
    {
      id: "auth",
      mountPath: `${config.app.apiPrefix}/auth`,
      router: createAuthRouter(config, options.auth)
    },
    {
      id: "jobs",
      mountPath: `${config.app.apiPrefix}/jobs`,
      router: createJobsRouter(config, options.jobs)
    },
    {
      id: "internal",
      mountPath: `${config.app.apiPrefix}/internal`,
      router: createInternalRouter(config, options.internal)
    },
    {
      id: "preferences",
      mountPath: `${config.app.apiPrefix}/me/preferences`,
      router: createPreferencesRouter(config, options.preferences)
    },
    {
      id: "bookmarks",
      mountPath: `${config.app.apiPrefix}/me/bookmarks`,
      router: createBookmarksRouter(config, options.bookmarks)
    },
    {
      id: "applications",
      mountPath: `${config.app.apiPrefix}/me/applications`,
      router: createApplicationsRouter(config, options.applications)
    },
    {
      id: "cv-files",
      mountPath: `${config.app.apiPrefix}/me/cv-files`,
      router: createCurrentUserCvFilesRouter(config, options.aiCvAnalyzer)
    },
    {
      id: "ai-cv-analyzer",
      mountPath: `${config.app.apiPrefix}/ai/cv-analyzer`,
      router: createAiCvAnalyzerRouter(config, options.aiCvAnalyzer)
    },
    {
      id: "ai-cv-generate",
      mountPath: `${config.app.apiPrefix}/ai/cv-generate`,
      router: createAiCvGenerateRouter(config, options.aiCvGenerate)
    },
    {
      id: "users",
      mountPath: `${config.app.apiPrefix}/me`,
      router: createUsersRouter(config, options.users)
    }
  ];
}

export function registerRoutes(
  app: Express,
  config: AppConfig,
  options: RouteOptions = {}
) {
  for (const mountedRouter of getMountedRouters(config, options)) {
    app.use(mountedRouter.mountPath, mountedRouter.router);
  }
}
