import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type {
  AiJobRecommendationsRepository,
  CvAnalysisResolverRecord,
  JobRecommendationRunDetailRecord,
  JobRecommendationRunSnapshotInput,
  RecommendationCandidateRecord
} from "@/modules/ai-job-recommendations/ai-job-recommendations.types";
import type { PreferenceContext } from "@/modules/preferences/preferences.types";
import type { JobRecord } from "@/modules/jobs";

type PrismaClientLike = typeof prisma | PrismaTransaction;

type JobListingWithRelations = Prisma.JobListingGetPayload<{
  include: typeof jobInclude;
}>;

type JobRecommendationRunWithItems = Prisma.JobRecommendationRunGetPayload<{
  include: ReturnType<typeof runInclude>;
}>;

type CvAnalysisResultWithJob = Prisma.CvAnalysisResultGetPayload<{
  include: {
    jobListing: {
      include: typeof jobInclude;
    };
  };
}>;

export class PrismaAiJobRecommendationsRepository implements AiJobRecommendationsRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async findCvAnalysisResultByIdForUser(
    userId: string,
    cvAnalysisResultId: string
  ): Promise<CvAnalysisResolverRecord | null> {
    const result = await this.client.cvAnalysisResult.findFirst({
      where: {
        id: cvAnalysisResultId,
        userId
      },
      include: {
        jobListing: {
          include: jobInclude
        }
      }
    });

    return result ? mapCvAnalysisResult(result) : null;
  }

  async findLatestCvAnalysisResultForUser(
    userId: string
  ): Promise<CvAnalysisResolverRecord | null> {
    const result = await this.client.cvAnalysisResult.findFirst({
      where: { userId },
      orderBy: [{ analyzedAt: "desc" }, { createdAt: "desc" }],
      include: {
        jobListing: {
          include: jobInclude
        }
      }
    });

    return result ? mapCvAnalysisResult(result) : null;
  }

  async findUserPreference(userId: string): Promise<PreferenceContext | null> {
    const preference = await this.client.userPreference.findUnique({
      where: { userId }
    });

    return mapPreference(preference);
  }

  async findRecommendationRunByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<JobRecommendationRunDetailRecord | null> {
    const run = await this.client.jobRecommendationRun.findFirst({
      where: {
        userId,
        idempotencyKey
      },
      include: runInclude(userId)
    });

    return run ? mapRun(run) : null;
  }

  async findLatestRecommendationRunForUser(
    userId: string
  ): Promise<JobRecommendationRunDetailRecord | null> {
    const run = await this.client.jobRecommendationRun.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      include: runInclude(userId)
    });

    return run ? mapRun(run) : null;
  }

  async findRecommendationRunByIdForUser(
    userId: string,
    recommendationRunId: string
  ): Promise<JobRecommendationRunDetailRecord | null> {
    const run = await this.client.jobRecommendationRun.findFirst({
      where: {
        id: recommendationRunId,
        userId
      },
      include: runInclude(userId)
    });

    return run ? mapRun(run) : null;
  }

  async findCandidateJobsForRecommendations(input: {
    userId: string;
    cvAnalysisResult: CvAnalysisResolverRecord;
    filters:
      | {
          location?: string | undefined;
          workType?: "REMOTE" | "HYBRID" | "ONSITE" | undefined;
          experienceLevel?:
            | "ENTRY_LEVEL"
            | "JUNIOR"
            | "MID_LEVEL"
            | "SENIOR"
            | "LEAD"
            | undefined;
          excludeAppliedJobs?: boolean | undefined;
          includeBookmarkedStatus?: boolean | undefined;
        }
      | null
      | undefined;
    limit: number;
  }): Promise<RecommendationCandidateRecord[]> {
    const where = buildCandidateWhere(input);
    const jobs = await this.client.jobListing.findMany({
      where,
      orderBy: [
        { sourcePostedAt: { sort: "desc", nulls: "last" } },
        { lastSeenAt: "desc" },
        { createdAt: "desc" }
      ],
      take: input.limit * 3,
      include: {
        ...jobInclude,
        bookmarks: {
          where: { userId: input.userId },
          select: { id: true }
        },
        applications: {
          where: { userId: input.userId },
          select: { id: true }
        }
      }
    });

    return jobs.map((job) => ({
      job: mapJob(job),
      isBookmarked: job.bookmarks.length > 0,
      hasApplied: job.applications.length > 0
    }));
  }

  async createRecommendationRunSnapshot(
    input: JobRecommendationRunSnapshotInput
  ): Promise<JobRecommendationRunDetailRecord> {
    const run = await this.client.jobRecommendationRun.create({
      data: {
        userId: input.userId,
        cvAnalysisResultId: input.cvAnalysisResultId,
        idempotencyKey: input.idempotencyKey,
        requestedLimit: input.requestedLimit,
        candidateCount: input.candidateCount,
        recommendationCount: input.recommendationCount,
        modelName: input.modelName,
        modelVersion: input.modelVersion,
        status: "SUCCEEDED",
        filtersSnapshot: input.filtersSnapshot ?? Prisma.DbNull,
        inputSummary: input.inputSummary,
        createdAt: input.createdAt,
        items: {
          create: input.items.map((item) => ({
            jobListingId: item.jobListingId,
            rank: item.rank,
            matchScore: item.matchScore,
            matchLevel: item.matchLevel,
            reasons: item.reasons,
            matchedSkills: item.matchedSkills,
            missingSkills: item.missingSkills,
            nextSteps: item.nextSteps
          }))
        }
      },
      include: runInclude(input.userId)
    });

    return mapRun(run);
  }
}

const jobInclude = {
  company: true,
  sourcePlatform: true,
  requirements: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  jobSkills: {
    include: { skill: true },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.JobListingInclude;

function runInclude(userId: string) {
  return {
    items: {
      orderBy: {
        rank: "asc" as const
      },
      include: {
        jobListing: {
          include: {
            ...jobInclude,
            bookmarks: {
              where: { userId },
              select: { id: true }
            },
            applications: {
              where: { userId },
              select: { id: true }
            }
          }
        }
      }
    }
  };
}

function mapCvAnalysisResult(
  result: CvAnalysisResultWithJob
): CvAnalysisResolverRecord {
  const jobFitAlignment = toJobFitAlignment(result.jobFitAlignment);
  const keywordOptimization = toKeywordOptimization(result.keywordOptimization);
  const actionableImprovements = toStringArray(result.actionableImprovements);

  return {
    id: result.id,
    userId: result.userId,
    jobListingId: result.jobListingId,
    analyzedAt: result.analyzedAt,
    job: mapJob(result.jobListing),
    jobFitAlignment,
    keywordOptimization,
    actionableImprovements
  };
}

function toJobFitAlignment(
  value: unknown
): CvAnalysisResolverRecord["jobFitAlignment"] {
  if (!value || typeof value !== "object") {
    return {
      score: 0,
      summary: "",
      matchedSignals: [],
      missingSignals: []
    };
  }

  const data = value as Record<string, unknown>;
  return {
    score:
      typeof data.score === "number" && Number.isFinite(data.score)
        ? Math.max(0, Math.min(100, Math.round(data.score)))
        : 0,
    summary: typeof data.summary === "string" ? data.summary : "",
    matchedSignals: toStringArray(data.matchedSignals),
    missingSignals: toStringArray(data.missingSignals)
  };
}

function toKeywordOptimization(
  value: unknown
): CvAnalysisResolverRecord["keywordOptimization"] {
  if (!value || typeof value !== "object") {
    return {
      recommendedKeywords: [],
      reason: ""
    };
  }

  const data = value as Record<string, unknown>;
  return {
    recommendedKeywords: toStringArray(data.recommendedKeywords),
    reason: typeof data.reason === "string" ? data.reason : ""
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapPreference(
  preference: {
    targetRoles: unknown;
    locations: unknown;
    workTypes: PreferenceContext["workTypes"];
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    salaryPeriod: PreferenceContext["salaryExpectation"]["period"];
  } | null
): PreferenceContext | null {
  if (!preference) {
    return null;
  }

  return {
    targetRoles: Array.isArray(preference.targetRoles)
      ? preference.targetRoles.filter(
          (value): value is string => typeof value === "string"
        )
      : [],
    locations: Array.isArray(preference.locations)
      ? preference.locations.flatMap((value) => {
          if (!value || typeof value !== "object") {
            return [];
          }

          const location = value as Record<string, unknown>;
          if (typeof location.province !== "string") {
            return [];
          }

          return [
            {
              province: location.province,
              city: typeof location.city === "string" ? location.city : null
            }
          ];
        })
      : [],
    workTypes: preference.workTypes,
    salaryExpectation: {
      min: preference.salaryMin,
      max: preference.salaryMax,
      currency: preference.salaryCurrency,
      period: preference.salaryPeriod
    }
  };
}

function buildCandidateWhere(input: {
  userId: string;
  cvAnalysisResult: CvAnalysisResolverRecord;
  filters:
    | {
        location?: string | undefined;
        workType?: "REMOTE" | "HYBRID" | "ONSITE" | undefined;
        experienceLevel?:
          | "ENTRY_LEVEL"
          | "JUNIOR"
          | "MID_LEVEL"
          | "SENIOR"
          | "LEAD"
          | undefined;
        excludeAppliedJobs?: boolean | undefined;
        includeBookmarkedStatus?: boolean | undefined;
      }
    | null
    | undefined;
  limit: number;
}): Prisma.JobListingWhereInput {
  const now = new Date();
  const conditions: Prisma.JobListingWhereInput[] = [
    { status: { in: ["ACTIVE", "STALE"] } },
    {
      OR: [{ expiredAt: null }, { expiredAt: { gt: now } }]
    }
  ];

  const roleHint =
    input.cvAnalysisResult.job.normalizedTitle ??
    input.cvAnalysisResult.job.title;
  if (roleHint) {
    conditions.push({
      OR: [
        { title: { contains: roleHint, mode: "insensitive" } },
        { normalizedTitle: { contains: roleHint, mode: "insensitive" } },
        { requirementSummary: { contains: roleHint, mode: "insensitive" } },
        { category: { contains: roleHint, mode: "insensitive" } }
      ]
    });
  }

  const filters = input.filters;
  if (filters?.location) {
    conditions.push({
      OR: [
        {
          locationDisplay: { contains: filters.location, mode: "insensitive" }
        },
        { province: { contains: filters.location, mode: "insensitive" } },
        { city: { contains: filters.location, mode: "insensitive" } }
      ]
    });
  }

  if (filters?.workType) {
    conditions.push({ workType: filters.workType });
  }

  if (filters?.experienceLevel) {
    conditions.push({ experienceLevel: filters.experienceLevel });
  }

  if (filters?.excludeAppliedJobs !== false) {
    conditions.push({
      applications: {
        none: {
          userId: input.userId
        }
      }
    });
  }

  const inferredSkills = [
    ...input.cvAnalysisResult.jobFitAlignment.matchedSignals,
    ...input.cvAnalysisResult.keywordOptimization.recommendedKeywords
  ]
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (inferredSkills.length > 0) {
    conditions.push({
      OR: inferredSkills.map((skill) => ({
        OR: [
          {
            jobSkills: {
              some: {
                skill: {
                  name: { equals: skill, mode: "insensitive" }
                }
              }
            }
          },
          {
            requirements: {
              some: {
                value: { contains: skill, mode: "insensitive" }
              }
            }
          }
        ]
      }))
    });
  }

  return { AND: conditions };
}

function mapRun(
  run: JobRecommendationRunWithItems
): JobRecommendationRunDetailRecord {
  return {
    id: run.id,
    cvAnalysisResultId: run.cvAnalysisResultId,
    createdAt: run.createdAt,
    modelName: run.modelName,
    modelVersion: run.modelVersion,
    candidateCount: run.candidateCount,
    recommendationCount: run.recommendationCount,
    items: run.items.map((item) => ({
      rank: item.rank,
      matchScore: item.matchScore,
      matchLevel: item.matchLevel,
      reasons: toStringArray(item.reasons),
      matchedSkills: toStringArray(item.matchedSkills),
      missingSkills: toStringArray(item.missingSkills),
      nextSteps: toStringArray(item.nextSteps),
      job: mapJob(item.jobListing),
      isBookmarked: item.jobListing.bookmarks.length > 0,
      hasApplied: item.jobListing.applications.length > 0
    }))
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
