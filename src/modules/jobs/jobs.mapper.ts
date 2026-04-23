import type { JobCard, JobDetail, JobRecord } from "@/modules/jobs/jobs.types";

export function isJobStale(
  lastSeenAt: Date,
  staleAfterHours: number,
  now: Date = new Date()
): boolean {
  const staleAfterMs = staleAfterHours * 60 * 60 * 1000;
  return now.getTime() - lastSeenAt.getTime() > staleAfterMs;
}

export function serializeJobCard(
  job: JobRecord,
  staleAfterHours: number,
  now: Date
): JobCard {
  return {
    id: job.id,
    title: job.title,
    company: {
      id: job.company.id,
      name: job.company.name,
      logoUrl: job.company.logoUrl
    },
    sourcePlatform: job.sourcePlatform,
    workType: job.workType,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    location: job.location,
    salary: job.salary,
    postedAt: job.postedAt?.toISOString() ?? null,
    lastSeenAt: job.lastSeenAt.toISOString(),
    isStale: isJobStale(job.lastSeenAt, staleAfterHours, now)
  };
}

export function serializeJobDetail(
  job: JobRecord,
  staleAfterHours: number,
  now: Date
): JobDetail {
  return {
    ...serializeJobCard(job, staleAfterHours, now),
    company: job.company,
    description: job.description,
    requirements: job.requirements.map((requirement) => ({
      type: requirement.type,
      value: requirement.value,
      priority: requirement.priority ?? "UNKNOWN"
    })),
    skills: job.skills.map((skill) => skill.name),
    externalApplyUrl: job.externalApplyUrl,
    sourceUrl: job.sourceUrl,
    sourceUpdatedAt: job.sourceUpdatedAt?.toISOString() ?? null,
    expiredAt: job.expiredAt?.toISOString() ?? null
  };
}

export function serializeProvidedFilters(filters: Record<string, unknown>) {
  return Object.entries(filters).reduce<Record<string, unknown>>(
    (serialized, [key, value]) => {
      if (value !== undefined) {
        serialized[key] = value;
      }

      return serialized;
    },
    {}
  );
}

export function hasSalaryOverlap(
  jobMin: number | null,
  jobMax: number | null,
  filterMin: number | undefined,
  filterMax: number | undefined
): boolean {
  if (filterMin === undefined && filterMax === undefined) {
    return true;
  }

  if (jobMin === null && jobMax === null) {
    return false;
  }

  const normalizedJobMin = jobMin ?? jobMax ?? 0;
  const normalizedJobMax = jobMax ?? jobMin ?? 0;

  if (filterMin !== undefined && normalizedJobMax < filterMin) {
    return false;
  }

  if (filterMax !== undefined && normalizedJobMin > filterMax) {
    return false;
  }

  return true;
}
