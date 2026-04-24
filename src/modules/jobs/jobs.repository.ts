import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import {
  hiddenDetailStatus,
  visibleListStatuses
} from "@/modules/jobs/jobs.constants";
import type { ListJobsQueryInput } from "@/modules/jobs/jobs.schema";
import type { JobRecord, JobsRepository } from "@/modules/jobs/jobs.types";

type PrismaClientLike = typeof prisma | PrismaTransaction;

type JobListingWithRelations = Prisma.JobListingGetPayload<{
  include: {
    company: true;
    sourcePlatform: true;
    requirements: true;
    jobSkills: {
      include: {
        skill: true;
      };
    };
  };
}>;

export class PrismaJobsRepository implements JobsRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async listJobs(query: ListJobsQueryInput) {
    const where = buildListWhere(query);
    const orderBy = buildOrderBy(query.sort);
    const skip = (query.page - 1) * query.limit;

    const items = await this.client.jobListing.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
      include: jobInclude
    });
    const total = await this.client.jobListing.count({ where });

    return {
      items: items.map(mapJob),
      total
    };
  }

  async findVisibleById(jobId: string): Promise<JobRecord | null> {
    const job = await this.client.jobListing.findFirst({
      where: {
        id: jobId,
        NOT: { status: hiddenDetailStatus }
      },
      include: jobInclude
    });

    return job ? mapJob(job) : null;
  }
}

const jobInclude = {
  company: true,
  sourcePlatform: true,
  requirements: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  jobSkills: {
    include: {
      skill: true
    },
    orderBy: {
      createdAt: "asc"
    }
  }
} satisfies Prisma.JobListingInclude;

function buildListWhere(
  query: ListJobsQueryInput
): Prisma.JobListingWhereInput {
  const conditions: Prisma.JobListingWhereInput[] = [
    { status: { in: [...visibleListStatuses] } }
  ];

  if (query.keyword) {
    conditions.push({
      OR: [
        { title: { contains: query.keyword, mode: "insensitive" } },
        { normalizedTitle: { contains: query.keyword, mode: "insensitive" } },
        { description: { contains: query.keyword, mode: "insensitive" } },
        {
          requirementSummary: {
            contains: query.keyword,
            mode: "insensitive"
          }
        },
        { company: { name: { contains: query.keyword, mode: "insensitive" } } }
      ]
    });
  }

  if (query.location) {
    conditions.push({
      OR: [
        { locationDisplay: { contains: query.location, mode: "insensitive" } },
        { province: { contains: query.location, mode: "insensitive" } },
        { city: { contains: query.location, mode: "insensitive" } }
      ]
    });
  }

  if (query.province) {
    conditions.push({
      province: { contains: query.province, mode: "insensitive" }
    });
  }

  if (query.city) {
    conditions.push({ city: { contains: query.city, mode: "insensitive" } });
  }

  if (query.workType) {
    conditions.push({ workType: query.workType });
  }

  if (query.employmentType) {
    conditions.push({ employmentType: query.employmentType });
  }

  if (query.experienceLevel) {
    conditions.push({ experienceLevel: query.experienceLevel });
  }

  if (query.salaryMin !== undefined) {
    conditions.push({
      OR: [{ salaryMax: { gte: query.salaryMin } }, { salaryMin: null }]
    });
  }

  if (query.salaryMax !== undefined) {
    conditions.push({
      OR: [{ salaryMin: { lte: query.salaryMax } }, { salaryMax: null }]
    });
  }

  if (query.sourcePlatform) {
    conditions.push({ sourcePlatform: { slug: query.sourcePlatform } });
  }

  if (query.skill) {
    conditions.push({
      OR: [
        {
          jobSkills: {
            some: {
              skill: { name: { equals: query.skill, mode: "insensitive" } }
            }
          }
        },
        {
          requirements: {
            some: { value: { contains: query.skill, mode: "insensitive" } }
          }
        }
      ]
    });
  }

  if (query.category) {
    conditions.push({
      category: { contains: query.category, mode: "insensitive" }
    });
  }

  return { AND: conditions };
}

function buildOrderBy(
  sort: ListJobsQueryInput["sort"]
): Prisma.JobListingOrderByWithRelationInput[] {
  if (sort === "salary_highest") {
    return [
      { salaryMax: { sort: "desc", nulls: "last" } },
      { salaryMin: { sort: "desc", nulls: "last" } },
      { sourcePostedAt: { sort: "desc", nulls: "last" } },
      { lastSeenAt: "desc" }
    ];
  }

  if (sort === "salary_lowest") {
    return [
      { salaryMin: { sort: "asc", nulls: "last" } },
      { salaryMax: { sort: "asc", nulls: "last" } },
      { sourcePostedAt: { sort: "desc", nulls: "last" } },
      { lastSeenAt: "desc" }
    ];
  }

  return [
    { sourcePostedAt: { sort: "desc", nulls: "last" } },
    { lastSeenAt: "desc" },
    { createdAt: "desc" }
  ];
}

function mapJob(job: JobListingWithRelations): JobRecord {
  return {
    id: job.id,
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    category: job.category,
    description: job.description,
    requirementSummary: job.requirementSummary,
    workType: job.workType,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    location: {
      display: job.locationDisplay,
      province: job.province,
      city: job.city
    },
    salary: {
      min: job.salaryMin,
      max: job.salaryMax,
      currency: job.salaryCurrency,
      period: job.salaryPeriod,
      display: job.salaryDisplay
    },
    sourceUrl: job.sourceUrl,
    externalApplyUrl: job.externalApplyUrl,
    postedAt: job.sourcePostedAt,
    sourceUpdatedAt: job.sourceUpdatedAt,
    lastSeenAt: job.lastSeenAt,
    expiredAt: job.expiredAt,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    company: {
      id: job.company.id,
      name: job.company.name,
      logoUrl: job.company.logoUrl,
      websiteUrl: job.company.websiteUrl
    },
    sourcePlatform: {
      id: job.sourcePlatform.id,
      name: job.sourcePlatform.name,
      slug: job.sourcePlatform.slug
    },
    requirements: job.requirements.map((requirement) => ({
      type: requirement.type,
      value: requirement.value,
      priority: requirement.priority,
      sortOrder: requirement.sortOrder
    })),
    skills: job.jobSkills.map((jobSkill) => ({
      name: jobSkill.skill.name
    }))
  };
}
