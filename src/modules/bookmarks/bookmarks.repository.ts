import type { Prisma } from "@/generated/prisma/client";
import { hiddenDetailStatus, visibleListStatuses } from "@/modules/jobs";
import type { JobRecord } from "@/modules/jobs";
import type { ListBookmarksQueryInput } from "@/modules/bookmarks/bookmarks.schema";
import type {
  BookmarkRecord,
  BookmarksRepository
} from "@/modules/bookmarks/bookmarks.types";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";

type PrismaClientLike = typeof prisma | PrismaTransaction;

type BookmarkWithJob = Prisma.BookmarkGetPayload<{
  include: {
    jobListing: {
      include: typeof jobInclude;
    };
  };
}>;

type JobListingWithRelations = Prisma.JobListingGetPayload<{
  include: typeof jobInclude;
}>;

export class PrismaBookmarksRepository implements BookmarksRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async listForUser(userId: string, query: ListBookmarksQueryInput) {
    const where = buildListWhere(userId, query);
    const orderBy = buildOrderBy(query.sort);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await this.client.$transaction([
      this.client.bookmark.findMany({
        where,
        orderBy,
        skip,
        take: query.limit,
        include: { jobListing: { include: jobInclude } }
      }),
      this.client.bookmark.count({ where })
    ]);

    return {
      items: items.map(mapBookmark),
      total
    };
  }

  async findVisibleJobById(jobId: string): Promise<JobRecord | null> {
    const job = await this.client.jobListing.findFirst({
      where: {
        id: jobId,
        status: { in: [...visibleListStatuses] }
      },
      include: jobInclude
    });

    return job ? mapJob(job) : null;
  }

  async findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<BookmarkRecord | null> {
    const bookmark = await this.client.bookmark.findUnique({
      where: {
        userId_jobListingId: {
          userId,
          jobListingId: jobId
        }
      },
      include: { jobListing: { include: jobInclude } }
    });

    return bookmark ? mapBookmark(bookmark) : null;
  }

  async createForUser(userId: string, jobId: string): Promise<BookmarkRecord> {
    const bookmark = await this.client.bookmark.create({
      data: {
        userId,
        jobListingId: jobId
      },
      include: { jobListing: { include: jobInclude } }
    });

    return mapBookmark(bookmark);
  }

  async deleteByUserAndJob(userId: string, jobId: string): Promise<boolean> {
    const result = await this.client.bookmark.deleteMany({
      where: {
        userId,
        jobListingId: jobId
      }
    });

    return result.count > 0;
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
  query: ListBookmarksQueryInput
): Prisma.BookmarkWhereInput {
  const conditions: Prisma.BookmarkWhereInput[] = [
    {
      userId,
      jobListing: {
        NOT: { status: hiddenDetailStatus }
      }
    }
  ];

  if (query.keyword) {
    conditions.push({
      jobListing: {
        OR: [
          { title: { contains: query.keyword, mode: "insensitive" } },
          {
            normalizedTitle: {
              contains: query.keyword,
              mode: "insensitive"
            }
          },
          { description: { contains: query.keyword, mode: "insensitive" } },
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
    });
  }

  return { AND: conditions };
}

function buildOrderBy(
  sort: ListBookmarksQueryInput["sort"]
): Prisma.BookmarkOrderByWithRelationInput[] {
  if (sort === "updated_desc") {
    return [{ jobListing: { updatedAt: "desc" } }, { createdAt: "desc" }];
  }

  if (sort === "newest") {
    return [
      { jobListing: { sourcePostedAt: { sort: "desc", nulls: "last" } } },
      { jobListing: { lastSeenAt: "desc" } },
      { createdAt: "desc" }
    ];
  }

  if (sort === "salary_highest") {
    return [
      { jobListing: { salaryMax: { sort: "desc", nulls: "last" } } },
      { jobListing: { salaryMin: { sort: "desc", nulls: "last" } } },
      { createdAt: "desc" }
    ];
  }

  if (sort === "salary_lowest") {
    return [
      { jobListing: { salaryMin: { sort: "asc", nulls: "last" } } },
      { jobListing: { salaryMax: { sort: "asc", nulls: "last" } } },
      { createdAt: "desc" }
    ];
  }

  return [{ createdAt: "desc" }];
}

function mapBookmark(bookmark: BookmarkWithJob): BookmarkRecord {
  return {
    id: bookmark.id,
    userId: bookmark.userId,
    jobListingId: bookmark.jobListingId,
    createdAt: bookmark.createdAt,
    job: mapJob(bookmark.jobListing)
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
