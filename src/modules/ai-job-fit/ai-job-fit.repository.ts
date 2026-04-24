import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type { JobRecord } from "@/modules/jobs";
import type {
  AiJobFitRepository,
  AiJobFitUserContext,
  JobFitAnalysisSnapshotInput
} from "@/modules/ai-job-fit/ai-job-fit.types";
import type { CurrentUserProfileRecord } from "@/modules/users";
import type { PreferenceContext } from "@/modules/preferences";

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

export class PrismaAiJobFitRepository implements AiJobFitRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async findUserContext(userId: string): Promise<AiJobFitUserContext | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userSkills: {
          include: { skill: true },
          orderBy: [{ createdAt: "asc" }]
        },
        experiences: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        preference: true
      }
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      profile: mapProfile(user.profile),
      skills: user.userSkills.map((userSkill) => ({
        id: userSkill.id,
        name: userSkill.skill.name,
        level: userSkill.level
      })),
      experience: user.experiences.map((experience) => ({
        id: experience.id,
        title: experience.title,
        company: experience.company,
        employmentType: experience.employmentType,
        startDate: experience.startDate,
        endDate: experience.endDate,
        isCurrent: experience.isCurrent,
        description: experience.description
      })),
      preference: mapPreference(user.preference)
    };
  }

  async findVisibleJob(jobId: string): Promise<JobRecord | null> {
    const job = await this.client.jobListing.findFirst({
      where: {
        id: jobId,
        NOT: { status: "HIDDEN" }
      },
      include: jobInclude
    });

    return job ? mapJob(job) : null;
  }

  async createSnapshot(input: JobFitAnalysisSnapshotInput): Promise<void> {
    await this.client.fitScoreResult.create({
      data: {
        userId: input.userId,
        jobListingId: input.jobId,
        fitScore: input.response.fitScore,
        readinessLevel: input.response.readinessLevel,
        recommendationDecision: input.response.recommendation.decision,
        recommendationSummary: input.response.recommendation.summary,
        breakdown: input.response.breakdown,
        modelName: input.response.model.name,
        modelVersion: input.response.model.version,
        analyzedAt: new Date(input.response.analyzedAt),
        inputSummary: createInputSummary(input.payload)
      }
    });
    await this.client.skillGapResult.create({
      data: {
        userId: input.userId,
        jobListingId: input.jobId,
        gaps: input.response.skillGaps,
        modelName: input.response.model.name,
        modelVersion: input.response.model.version,
        analyzedAt: new Date(input.response.analyzedAt),
        inputSummary: createInputSummary(input.payload)
      }
    });
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

function mapProfile(
  profile: {
    careerStatus: CurrentUserProfileRecord["careerStatus"];
    latestRole: string | null;
    summary: string | null;
    profilePhotoStorageKey: string | null;
    profilePhotoUrl: string | null;
    profilePhotoMimeType: string | null;
    profilePhotoSizeBytes: number | null;
  } | null
): CurrentUserProfileRecord | null {
  if (!profile) {
    return null;
  }

  return {
    careerStatus: profile.careerStatus,
    latestRole: profile.latestRole,
    summary: profile.summary,
    profilePhotoStorageKey: profile.profilePhotoStorageKey,
    profilePhotoUrl: profile.profilePhotoUrl,
    profilePhotoMimeType: profile.profilePhotoMimeType,
    profilePhotoSizeBytes: profile.profilePhotoSizeBytes
  };
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

function createInputSummary(payload: JobFitAnalysisSnapshotInput["payload"]) {
  return {
    requestId: payload.requestId,
    inputVersion: payload.inputVersion,
    user: {
      careerStatus: payload.user.careerStatus,
      skillCount: payload.user.skills.length,
      experienceCount: payload.user.experience.length
    },
    preferences: {
      targetRoleCount: payload.preferences.targetRoles.length,
      locationCount: payload.preferences.locations.length,
      workTypes: payload.preferences.workTypes,
      hasSalaryExpectation: payload.preferences.salaryExpectation !== null
    },
    job: {
      id: payload.job.id,
      requirementCount: payload.job.requirements.length,
      skillCount: payload.job.skills.length
    }
  } satisfies Prisma.InputJsonValue;
}
