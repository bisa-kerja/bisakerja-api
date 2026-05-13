type SerializableJobRecord = {
  id: string;
  title: string;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
    websiteUrl?: string | null;
  };
  sourcePlatform: {
    id: string;
    name: string;
    slug: string;
  };
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
  location: {
    display: string | null;
    province: string | null;
    city: string | null;
  };
  salary: {
    min: number | null;
    max: number | null;
    currency: string;
    period: "MONTHLY" | "YEARLY" | null;
    display: string | null;
  };
  postedAt: Date | null;
  lastSeenAt: Date;
  description: string | null;
  requirements: {
    type: "SKILL" | "EXPERIENCE" | "EDUCATION" | "RESPONSIBILITY" | "OTHER";
    value: string;
    priority: "HIGH" | "MEDIUM" | "LOW" | null;
  }[];
  skills: { name: string }[];
  externalApplyUrl: string;
  sourceUrl: string;
  sourceUpdatedAt: Date | null;
  expiredAt: Date | null;
};

export function isJobStale(
  lastSeenAt: Date,
  staleAfterHours: number,
  now: Date = new Date()
): boolean {
  const staleAfterMs = staleAfterHours * 60 * 60 * 1000;
  return now.getTime() - lastSeenAt.getTime() > staleAfterMs;
}

export function serializeJobCard(
  job: SerializableJobRecord,
  staleAfterHours: number,
  now: Date
) {
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
  job: SerializableJobRecord,
  staleAfterHours: number,
  now: Date
) {
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
