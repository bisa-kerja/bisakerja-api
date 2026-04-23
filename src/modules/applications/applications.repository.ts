import type { Prisma } from "@/generated/prisma/client";
import { hiddenDetailStatus } from "@/modules/jobs";
import type { JobRecord } from "@/modules/jobs";
import type {
  CreateApplicationInput,
  ListApplicationsQueryInput,
  UpdateApplicationInput,
  UpdateApplicationStatusInput
} from "@/modules/applications/applications.schema";
import type {
  ApplicationRecord,
  ApplicationsRepository,
  ApplicationStatusHistoryRecord
} from "@/modules/applications/applications.types";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";

type PrismaClientLike = typeof prisma | PrismaTransaction;

type ApplicationWithJob = Prisma.ApplicationRecordGetPayload<{
  include: {
    jobListing: {
      include: typeof jobInclude;
    };
  };
}>;

type JobListingWithRelations = Prisma.JobListingGetPayload<{
  include: typeof jobInclude;
}>;

export class PrismaApplicationsRepository implements ApplicationsRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async listForUser(userId: string, query: ListApplicationsQueryInput) {
    const where = buildListWhere(userId, query);
    const orderBy = buildOrderBy(query.sort);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await this.client.$transaction([
      this.client.applicationRecord.findMany({
        where,
        orderBy,
        skip,
        take: query.limit,
        include: { jobListing: { include: jobInclude } }
      }),
      this.client.applicationRecord.count({ where })
    ]);

    return {
      items: items.map(mapApplication),
      total
    };
  }

  async findTrackableJobById(jobId: string): Promise<JobRecord | null> {
    const job = await this.client.jobListing.findFirst({
      where: {
        id: jobId,
        NOT: { status: hiddenDetailStatus }
      },
      include: jobInclude
    });

    return job ? mapJob(job) : null;
  }

  async findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<ApplicationRecord | null> {
    const application = await this.client.applicationRecord.findUnique({
      where: {
        userId_jobListingId: {
          userId,
          jobListingId: jobId
        }
      },
      include: { jobListing: { include: jobInclude } }
    });

    return application ? mapApplication(application) : null;
  }

  async findByIdForUser(
    userId: string,
    applicationId: string
  ): Promise<ApplicationRecord | null> {
    const application = await this.client.applicationRecord.findFirst({
      where: {
        id: applicationId,
        userId
      },
      include: { jobListing: { include: jobInclude } }
    });

    return application ? mapApplication(application) : null;
  }

  async createForUser(
    userId: string,
    input: CreateApplicationInput
  ): Promise<ApplicationRecord> {
    const application = await this.client.$transaction(async (tx) => {
      const created = await tx.applicationRecord.create({
        data: {
          userId,
          jobListingId: input.jobId,
          status: input.status,
          source: input.source,
          notes: input.notes
        },
        include: { jobListing: { include: jobInclude } }
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationRecordId: created.id,
          userId,
          fromStatus: null,
          toStatus: created.status,
          notes: input.notes
        }
      });

      return created;
    });

    return mapApplication(application);
  }

  async updateForUser(
    userId: string,
    applicationId: string,
    input: UpdateApplicationInput
  ): Promise<ApplicationRecord | null> {
    const result = await this.client.applicationRecord.updateMany({
      where: {
        id: applicationId,
        userId
      },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.source !== undefined ? { source: input.source } : {})
      }
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByIdForUser(userId, applicationId);
  }

  async updateStatusForUser(
    userId: string,
    applicationId: string,
    input: UpdateApplicationStatusInput,
    fromStatus: ApplicationRecord["status"]
  ): Promise<ApplicationRecord | null> {
    const application = await this.client.$transaction(async (tx) => {
      const result = await tx.applicationRecord.updateMany({
        where: {
          id: applicationId,
          userId
        },
        data: {
          status: input.status,
          ...(input.notes !== undefined ? { notes: input.notes } : {})
        }
      });

      if (result.count === 0) {
        return null;
      }

      await tx.applicationStatusHistory.create({
        data: {
          applicationRecordId: applicationId,
          userId,
          fromStatus,
          toStatus: input.status,
          notes: input.notes
        }
      });

      return tx.applicationRecord.findFirst({
        where: {
          id: applicationId,
          userId
        },
        include: { jobListing: { include: jobInclude } }
      });
    });

    return application ? mapApplication(application) : null;
  }

  async listHistory(
    applicationId: string
  ): Promise<ApplicationStatusHistoryRecord[]> {
    const history = await this.client.applicationStatusHistory.findMany({
      where: { applicationRecordId: applicationId },
      orderBy: { createdAt: "asc" }
    });

    return history;
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
  userId: string,
  query: ListApplicationsQueryInput
): Prisma.ApplicationRecordWhereInput {
  const conditions: Prisma.ApplicationRecordWhereInput[] = [
    {
      userId,
      jobListing: {
        NOT: { status: hiddenDetailStatus }
      }
    }
  ];

  if (query.status) {
    conditions.push({ status: query.status });
  }

  if (query.keyword) {
    conditions.push({
      OR: [
        { notes: { contains: query.keyword, mode: "insensitive" } },
        {
          jobListing: {
            OR: [
              { title: { contains: query.keyword, mode: "insensitive" } },
              {
                normalizedTitle: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                description: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                requirementSummary: {
                  contains: query.keyword,
                  mode: "insensitive"
                }
              },
              {
                company: {
                  name: { contains: query.keyword, mode: "insensitive" }
                }
              }
            ]
          }
        }
      ]
    });
  }

  return { AND: conditions };
}

function buildOrderBy(
  sort: ListApplicationsQueryInput["sort"]
): Prisma.ApplicationRecordOrderByWithRelationInput[] {
  if (sort === "created_desc") {
    return [{ createdAt: "desc" }];
  }

  if (sort === "newest") {
    return [{ appliedAt: "desc" }, { createdAt: "desc" }];
  }

  return [{ updatedAt: "desc" }, { createdAt: "desc" }];
}

function mapApplication(application: ApplicationWithJob): ApplicationRecord {
  return {
    id: application.id,
    userId: application.userId,
    jobListingId: application.jobListingId,
    status: application.status,
    source: application.source,
    notes: application.notes,
    appliedAt: application.appliedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    job: mapJob(application.jobListing)
  };
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
