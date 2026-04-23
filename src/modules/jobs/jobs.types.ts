import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type { ListJobsQueryInput } from "@/modules/jobs/jobs.schema";

export type JobSort = ListJobsQueryInput["sort"];

export type JobListFilters = Omit<
  ListJobsQueryInput,
  "page" | "limit" | "sort"
>;

export type JobSalary = {
  min: number | null;
  max: number | null;
  currency: string;
  period: "MONTHLY" | "YEARLY" | null;
  display: string | null;
};

export type JobLocation = {
  display: string | null;
  province: string | null;
  city: string | null;
};

export type JobCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl?: string | null;
};

export type JobSourcePlatform = {
  id: string;
  name: string;
  slug: string;
};

export type JobRequirementRecord = {
  type: "SKILL" | "EXPERIENCE" | "EDUCATION" | "RESPONSIBILITY" | "OTHER";
  value: string;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  sortOrder: number;
};

export type JobSkillRecord = {
  name: string;
};

export type JobRecord = {
  id: string;
  title: string;
  normalizedTitle: string | null;
  category: string | null;
  description: string | null;
  requirementSummary: string | null;
  workType: "REMOTE" | "HYBRID" | "ONSITE" | null;
  employmentType:
    | "FULL_TIME"
    | "PART_TIME"
    | "INTERNSHIP"
    | "CONTRACT"
    | "FREELANCE"
    | null;
  experienceLevel:
    | "ENTRY_LEVEL"
    | "JUNIOR"
    | "MID_LEVEL"
    | "SENIOR"
    | "LEAD"
    | null;
  location: JobLocation;
  salary: JobSalary;
  sourceUrl: string;
  externalApplyUrl: string;
  postedAt: Date | null;
  sourceUpdatedAt: Date | null;
  lastSeenAt: Date;
  expiredAt: Date | null;
  status: "ACTIVE" | "STALE" | "EXPIRED" | "CLOSED" | "HIDDEN";
  createdAt: Date;
  updatedAt: Date;
  company: JobCompany;
  sourcePlatform: JobSourcePlatform;
  requirements: JobRequirementRecord[];
  skills: JobSkillRecord[];
};

export type JobCard = {
  id: string;
  title: string;
  company: JobCompany;
  sourcePlatform: JobSourcePlatform;
  workType: JobRecord["workType"];
  employmentType: JobRecord["employmentType"];
  experienceLevel: JobRecord["experienceLevel"];
  location: JobLocation;
  salary: JobSalary;
  postedAt: string | null;
  lastSeenAt: string;
  isStale: boolean;
};

export type JobDetail = JobCard & {
  description: string | null;
  requirements: {
    type: JobRequirementRecord["type"];
    value: string;
    priority: JobRequirementRecord["priority"] | "UNKNOWN";
  }[];
  skills: string[];
  externalApplyUrl: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  expiredAt: string | null;
};

export type JobListResult = {
  items: JobRecord[];
  total: number;
};

export type JobsRepository = {
  listJobs(query: ListJobsQueryInput): Promise<JobListResult>;
  findVisibleById(jobId: string): Promise<JobRecord | null>;
};

export type JobsServiceOptions = {
  staleAfterHours: number;
  now?: () => Date;
};

export type JobsControllerDependencies = {
  repository: JobsRepository;
  config: AppConfig;
  now?: () => Date;
};

export type JobsRouterOptions = {
  repository?: JobsRepository;
  now?: () => Date;
  authMiddleware?: RequestHandler;
};
