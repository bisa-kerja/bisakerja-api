import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type {
  NotificationEventsInput,
  ScraperJobsSyncInput
} from "@/modules/internal/internal.schema";

export type ScraperJobSyncResult = {
  externalJobId: string;
  sourcePlatform: string;
  jobId: string;
  action: "created" | "updated";
};

export type ScraperJobsSyncResult = {
  accepted: number;
  upserted: number;
  jobs: ScraperJobSyncResult[];
};

export type NotificationEventsResult = {
  accepted: number;
  runId: string;
};

export type InternalRepository = {
  syncScraperJobs(input: ScraperJobsSyncInput): Promise<ScraperJobsSyncResult>;
  acceptNotificationEvents(
    input: NotificationEventsInput
  ): Promise<NotificationEventsResult>;
};

export type InternalControllerDependencies = {
  repository: InternalRepository;
  config: AppConfig;
};

export type InternalRouterOptions = {
  repository?: InternalRepository;
  authMiddleware?: RequestHandler;
};
