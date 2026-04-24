import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type {
  CreateApplicationInput,
  ListApplicationsQueryInput,
  UpdateApplicationInput,
  UpdateApplicationStatusInput
} from "@/modules/applications/applications.schema";
import type { JobCard, JobRecord } from "@/modules/jobs";

export type ApplicationStatus = CreateApplicationInput["status"];
export type ApplicationSource = CreateApplicationInput["source"];

export type ApplicationRecord = {
  id: string;
  userId: string;
  jobListingId: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  notes: string | null;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  job: JobRecord;
};

export type ApplicationResource = {
  id: string;
  status: ApplicationStatus;
  notes: string | null;
  source: ApplicationSource;
  appliedAt: string;
  updatedAt: string;
  job: JobCard;
};

export type UpdateApplicationStatusResult = {
  application: ApplicationResource;
  previousStatus: ApplicationStatus;
};

export type ApplicationListResult = {
  items: ApplicationRecord[];
  total: number;
};

export type ApplicationStatusHistoryRecord = {
  id: string;
  applicationRecordId: string;
  userId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  notes: string | null;
  createdAt: Date;
};

export type ApplicationsRepository = {
  listForUser(
    userId: string,
    query: ListApplicationsQueryInput
  ): Promise<ApplicationListResult>;
  findTrackableJobById(jobId: string): Promise<JobRecord | null>;
  findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<ApplicationRecord | null>;
  findByIdForUser(
    userId: string,
    applicationId: string
  ): Promise<ApplicationRecord | null>;
  createForUser(
    userId: string,
    input: CreateApplicationInput
  ): Promise<ApplicationRecord>;
  updateForUser(
    userId: string,
    applicationId: string,
    input: UpdateApplicationInput
  ): Promise<ApplicationRecord | null>;
  updateStatusForUser(
    userId: string,
    applicationId: string,
    input: UpdateApplicationStatusInput,
    fromStatus: ApplicationStatus
  ): Promise<ApplicationRecord | null>;
  listHistory(applicationId: string): Promise<ApplicationStatusHistoryRecord[]>;
};

export type ApplicationsServiceOptions = {
  staleAfterHours: number;
  now?: () => Date;
};

export type ApplicationsControllerDependencies = {
  repository: ApplicationsRepository;
  config: AppConfig;
  now?: () => Date;
};

export type ApplicationsRouterOptions = {
  repository?: ApplicationsRepository;
  now?: () => Date;
  authMiddleware?: RequestHandler;
};
