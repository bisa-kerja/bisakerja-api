import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type {
  NotificationEventsInput,
  ScraperJobSyncInput,
  ScraperJobsSyncInput
} from "@/modules/internal/internal.schema";
import type {
  InternalRepository,
  ScraperJobSyncResult
} from "@/modules/internal/internal.types";

export class PrismaInternalRepository implements InternalRepository {
  constructor(private readonly client: typeof prisma = prisma) {}

  async syncScraperJobs(input: ScraperJobsSyncInput): Promise<{
    accepted: number;
    upserted: number;
    jobs: ScraperJobSyncResult[];
  }> {
    return this.client.$transaction(async (tx) => {
      const jobs: ScraperJobSyncResult[] = [];
      const ingestionRunCounts = countJobsByIngestionRun(input.jobs);

      for (const job of input.jobs) {
        jobs.push(await syncOneJob(tx, job, ingestionRunCounts));
      }

      return {
        accepted: input.jobs.length,
        upserted: jobs.length,
        jobs
      };
    });
  }

  acceptNotificationEvents(input: NotificationEventsInput) {
    return Promise.resolve({
      accepted: input.candidates.length,
      runId: input.runId
    });
  }
}

async function syncOneJob(
  tx: PrismaTransaction,
  job: ScraperJobSyncInput,
  ingestionRunCounts: Map<string, number>
): Promise<ScraperJobSyncResult> {
  const sourcePlatform = await tx.sourcePlatform.upsert({
    where: { slug: normalizeSlug(job.sourcePlatform.slug) },
    update: {
      name: job.sourcePlatform.name,
      isActive: true
    },
    create: {
      slug: normalizeSlug(job.sourcePlatform.slug),
      name: job.sourcePlatform.name,
      isActive: true
    }
  });
  const company = await upsertCompany(tx, job);
  const ingestionRunId = await upsertIngestionRun(
    tx,
    job,
    sourcePlatform.id,
    ingestionRunCounts
  );
  const existing = await tx.jobListing.findFirst({
    where: {
      sourcePlatformId: sourcePlatform.id,
      externalJobId: job.jobListing.externalJobId
    },
    select: { id: true }
  });
  const jobListingData = jobListingPrismaData(
    job,
    sourcePlatform.id,
    company.id,
    ingestionRunId
  );
  const listing =
    existing === null
      ? await tx.jobListing.create({ data: jobListingData })
      : await tx.jobListing.update({
          where: { id: existing.id },
          data: jobListingData
        });

  await replaceRequirements(tx, listing.id, job);
  await replaceSkills(tx, listing.id, job);

  return {
    externalJobId: job.jobListing.externalJobId,
    sourcePlatform: normalizeSlug(job.sourcePlatform.slug),
    jobId: listing.id,
    action: existing === null ? "created" : "updated"
  };
}

async function upsertCompany(tx: PrismaTransaction, job: ScraperJobSyncInput) {
  const slug = normalizeSlug(job.company.sourceSlug ?? job.company.name);
  const existing = await tx.company.findFirst({
    where: { slug },
    select: { id: true }
  });
  const data = {
    name: job.company.name,
    slug,
    logoUrl: job.company.logoUrl ?? null,
    websiteUrl: job.company.websiteUrl ?? null
  };

  if (existing) {
    return tx.company.update({
      where: { id: existing.id },
      data
    });
  }

  return tx.company.create({ data });
}

async function upsertIngestionRun(
  tx: PrismaTransaction,
  job: ScraperJobSyncInput,
  sourcePlatformId: string,
  ingestionRunCounts: Map<string, number>
) {
  const sourceRunId = job.ingestionRun?.sourceRunId;

  if (!sourceRunId) {
    return null;
  }

  const id = ingestionRunId(sourceRunId, job.sourcePlatform.slug);
  const observedCount = ingestionRunCounts.get(id) ?? 1;

  await tx.ingestionRun.upsert({
    where: { id },
    update: {
      status: "completed",
      observedCount,
      upsertedCount: observedCount,
      errorCount: 0,
      finishedAt: new Date()
    },
    create: {
      id,
      sourcePlatformId,
      startedAt: new Date(job.jobListing.lastSeenAt),
      finishedAt: new Date(),
      status: "completed",
      observedCount,
      upsertedCount: observedCount,
      errorCount: 0
    }
  });

  return id;
}

function jobListingPrismaData(
  job: ScraperJobSyncInput,
  sourcePlatformId: string,
  companyId: string,
  ingestionRunId: string | null
): Prisma.JobListingUncheckedCreateInput {
  return {
    sourcePlatformId,
    companyId,
    ingestionRunId,
    externalJobId: job.jobListing.externalJobId,
    title: job.jobListing.title,
    normalizedTitle: job.jobListing.normalizedTitle ?? null,
    category: job.jobListing.category ?? null,
    description: job.jobListing.description ?? null,
    requirementSummary: job.jobListing.requirementSummary ?? null,
    workType: job.jobListing.workType ?? null,
    employmentType: job.jobListing.employmentType ?? null,
    experienceLevel: job.jobListing.experienceLevel ?? null,
    locationDisplay: job.jobListing.locationDisplay ?? null,
    province: job.jobListing.province ?? null,
    city: job.jobListing.city ?? null,
    salaryMin: job.jobListing.salaryMin ?? null,
    salaryMax: job.jobListing.salaryMax ?? null,
    salaryCurrency: job.jobListing.salaryCurrency.toUpperCase(),
    salaryPeriod: job.jobListing.salaryPeriod ?? null,
    salaryDisplay: job.jobListing.salaryDisplay ?? null,
    sourceUrl: job.jobListing.sourceUrl,
    externalApplyUrl: job.jobListing.externalApplyUrl,
    sourcePostedAt: toDateOrNull(job.jobListing.sourcePostedAt),
    sourceUpdatedAt: toDateOrNull(job.jobListing.sourceUpdatedAt),
    lastSeenAt: new Date(job.jobListing.lastSeenAt),
    status: job.jobListing.status
  };
}

async function replaceRequirements(
  tx: PrismaTransaction,
  jobListingId: string,
  job: ScraperJobSyncInput
) {
  await tx.jobRequirement.deleteMany({ where: { jobListingId } });

  if (job.requirements.length === 0) {
    return;
  }

  await tx.jobRequirement.createMany({
    data: job.requirements.map((requirement, index) => ({
      jobListingId,
      type: requirement.type,
      value: requirement.value,
      priority: requirement.priority ?? null,
      sortOrder: index
    }))
  });
}

async function replaceSkills(
  tx: PrismaTransaction,
  jobListingId: string,
  job: ScraperJobSyncInput
) {
  await tx.jobSkill.deleteMany({ where: { jobListingId } });

  for (const skillInput of uniqueSkills(job.skills)) {
    const slug = normalizeSlug(skillInput.name);
    const skill = await tx.skill.upsert({
      where: { slug },
      update: { name: skillInput.name },
      create: {
        slug,
        name: skillInput.name
      }
    });

    await tx.jobSkill.create({
      data: {
        jobListingId,
        skillId: skill.id,
        confidence: skillInput.confidence ?? undefined
      }
    });
  }
}

function uniqueSkills(skills: ScraperJobSyncInput["skills"]) {
  const seen = new Set<string>();

  return skills.filter((skill) => {
    const slug = normalizeSlug(skill.name);

    if (seen.has(slug)) {
      return false;
    }

    seen.add(slug);
    return true;
  });
}

function countJobsByIngestionRun(jobs: ScraperJobSyncInput[]) {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    const sourceRunId = job.ingestionRun?.sourceRunId;

    if (!sourceRunId) {
      continue;
    }

    const id = ingestionRunId(sourceRunId, job.sourcePlatform.slug);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

function ingestionRunId(sourceRunId: string, sourcePlatformSlug: string) {
  return `${sourceRunId}:${normalizeSlug(sourcePlatformSlug)}`;
}

function normalizeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "unknown";
}

function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null;
}
