import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type { ListBookmarksQueryInput } from "@/modules/bookmarks/bookmarks.schema";
import type { JobCard, JobRecord } from "@/modules/jobs";

export type BookmarkRecord = {
  id: string;
  userId: string;
  jobListingId: string;
  createdAt: Date;
  job: JobRecord;
};

export type BookmarkSummary = {
  id: string;
  jobId: string;
  createdAt: string;
};

export type BookmarkResource = {
  id: string;
  job: JobCard;
  createdAt: string;
};

export type BookmarkListResult = {
  items: BookmarkRecord[];
  total: number;
};

export type BookmarksRepository = {
  listForUser(
    userId: string,
    query: ListBookmarksQueryInput
  ): Promise<BookmarkListResult>;
  findVisibleJobById(jobId: string): Promise<JobRecord | null>;
  findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<BookmarkRecord | null>;
  createForUser(userId: string, jobId: string): Promise<BookmarkRecord>;
  deleteByUserAndJob(userId: string, jobId: string): Promise<boolean>;
};

export type BookmarksServiceOptions = {
  staleAfterHours: number;
  now?: () => Date;
};

export type BookmarksControllerDependencies = {
  repository: BookmarksRepository;
  config: AppConfig;
  now?: () => Date;
};

export type BookmarksRouterOptions = {
  repository?: BookmarksRepository;
  now?: () => Date;
  authMiddleware?: RequestHandler;
};
