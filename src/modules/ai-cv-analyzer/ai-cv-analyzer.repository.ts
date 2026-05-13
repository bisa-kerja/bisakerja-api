import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type { JobRecord } from "@/modules/jobs";
import type {
  AiCvAnalyzerRepository,
  CvAnalysisSnapshotInput,
  CvFileMetadataRecord,
  ExpiredCvFileRecord
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";

type PrismaClientLike = typeof prisma | PrismaTransaction;

type JobListingWithRelations = Prisma.JobListingGetPayload<{
  include: typeof jobInclude;
}>;

export class PrismaAiCvAnalyzerRepository implements AiCvAnalyzerRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

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

  async hasOwnedBookmarkForJob(
    userId: string,
    jobId: string
  ): Promise<boolean> {
    const bookmark = await this.client.bookmark.findUnique({
      where: {
        userId_jobListingId: {
          userId,
          jobListingId: jobId
        }
      },
      select: { id: true }
    });

    return Boolean(bookmark);
  }

  async createCvFileMetadata(input: {
    id: string;
    userId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    storageDriver: "LOCAL";
    storageKey: string;
    expiresAt: Date;
  }): Promise<CvFileMetadataRecord> {
    const record = await this.client.cvFileMetadata.create({
      data: {
        id: input.id,
        userId: input.userId,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageDriver: input.storageDriver,
        storageKey: input.storageKey,
        expiresAt: input.expiresAt
      }
    });

    return {
      id: record.id,
      userId: record.userId,
      originalFileName: record.originalFileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      storageDriver: record.storageDriver,
      storageKey: record.storageKey,
      uploadedAt: record.uploadedAt,
      expiresAt: record.expiresAt,
      deletedAt: record.deletedAt
    };
  }

  async markCvFileDeleted(fileId: string, deletedAt: Date): Promise<void> {
    await this.client.cvFileMetadata.updateMany({
      where: {
        id: fileId,
        deletedAt: null
      },
      data: {
        deletedAt
      }
    });
  }

  async createSnapshot(input: CvAnalysisSnapshotInput): Promise<void> {
    await this.client.cvAnalysisResult.create({
      data: {
        userId: input.userId,
        jobListingId: input.jobId,
        cvFileMetadataId: input.cvFileMetadataId,
        language: input.language,
        inputMode: input.inputMode,
        compareSource: input.compareSource,
        overallImpression: input.response.overallImpression,
        jobFitAlignment: input.response.jobFitAlignment,
        atsFriendliness: input.response.atsFriendliness,
        keywordOptimization: input.response.keywordOptimization,
        experienceQuantification: input.response.experienceQuantification,
        actionableImprovements: input.response.actionableImprovements,
        modelName: input.response.model.name,
        modelVersion: input.response.model.version,
        analyzedAt: new Date(input.response.analyzedAt),
        inputSummary: createInputSummary(input)
      }
    });
  }

  async findExpiredActiveCvFiles(now: Date): Promise<ExpiredCvFileRecord[]> {
    const records = await this.client.cvFileMetadata.findMany({
      where: {
        deletedAt: null,
        expiresAt: {
          lte: now
        }
      },
      select: {
        id: true,
        storageKey: true
      },
      orderBy: {
        expiresAt: "asc"
      }
    });

    return records;
  }

  async markCvFilesDeleted(
    fileIds: string[],
    deletedAt: Date
  ): Promise<number> {
    if (fileIds.length === 0) {
      return 0;
    }

    const result = await this.client.cvFileMetadata.updateMany({
      where: {
        id: {
          in: fileIds
        },
        deletedAt: null
      },
      data: {
        deletedAt
      }
    });

    return result.count;
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

function createInputSummary(input: CvAnalysisSnapshotInput) {
  return {
    requestId: input.payload.requestId,
    jobId: input.jobId,
    cvFileMetadataId: input.cvFileMetadataId,
    language: input.language,
    inputMode: input.inputMode,
    compareSource: input.compareSource,
    file: {
      mimeType: input.payload.cv.mimeType,
      sizeBytes: input.payload.cv.sizeBytes
    }
  };
}
