import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type {
  AiCvAnalyzerRepository,
  CvAnalysisResultListQuery,
  CvAnalysisResultRecord,
  CvAnalysisSnapshotInput,
  CvFileMetadataRecord,
  ExpiredCvFileRecord
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";

type PrismaClientLike = typeof prisma | PrismaTransaction;

export class PrismaAiCvAnalyzerRepository implements AiCvAnalyzerRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async createCvFileMetadata(input: {
    id: string;
    userId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    storageDriver: "LOCAL";
    storageKey: string;
    expiresAt: Date;
    isActive?: boolean;
  }): Promise<CvFileMetadataRecord> {
    if (input.isActive && hasTransaction(this.client)) {
      const record = await this.client.$transaction((transaction) =>
        createCvFileMetadataRecord(transaction, input)
      );

      return mapCvFileMetadata(record);
    }

    const record = await createCvFileMetadataRecord(this.client, input);

    return mapCvFileMetadata(record);
  }

  async findActiveCvFileMetadata(
    userId: string,
    now: Date
  ): Promise<CvFileMetadataRecord | null> {
    const record = await this.client.cvFileMetadata.findFirst({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
        expiresAt: {
          gt: now
        }
      },
      orderBy: {
        uploadedAt: "desc"
      }
    });

    return record ? mapCvFileMetadata(record) : null;
  }

  async findCvFileMetadataById(
    cvFileId: string,
    now: Date
  ): Promise<CvFileMetadataRecord | null> {
    const record = await this.client.cvFileMetadata.findFirst({
      where: {
        id: cvFileId,
        deletedAt: null,
        expiresAt: {
          gt: now
        }
      }
    });

    return record ? mapCvFileMetadata(record) : null;
  }

  async markCvFileDeleted(fileId: string, deletedAt: Date): Promise<void> {
    await this.client.cvFileMetadata.updateMany({
      where: {
        id: fileId,
        deletedAt: null
      },
      data: {
        deletedAt,
        isActive: false
      }
    });
  }

  async createSnapshot(input: CvAnalysisSnapshotInput): Promise<void> {
    const data: Prisma.CvAnalysisResultUncheckedCreateInput & {
      jobRecommendations: unknown;
    } = {
      userId: input.userId,
      jobListingId: null,
      cvFileMetadataId: input.cvFileMetadataId,
      language: input.language,
      inputMode: input.inputMode,
      compareSource: input.compareSource,
      schemaVersion: input.response.schemaVersion,
      overallImpression: input.response.overallImpression,
      jobFitAlignment: input.response.jobFitAlignment,
      atsFriendliness: input.response.atsFriendliness,
      topActionables: input.response.topActionables,
      sectionReviews: input.response.sectionReviews,
      jobRecommendations: input.response.jobRecommendations,
      modelName: input.response.model.name,
      modelVersion: input.response.model.version,
      analyzedAt: new Date(input.response.analyzedAt),
      inputSummary: createInputSummary(input)
    };

    await this.client.cvAnalysisResult.create({ data });
  }

  async listAnalysisResults(userId: string, query: CvAnalysisResultListQuery) {
    const where = createAnalysisResultWhere(userId, query);
    const skip = (query.page - 1) * query.limit;
    const orderBy = [
      { analyzedAt: query.sortOrder },
      { id: query.sortOrder }
    ] satisfies Prisma.CvAnalysisResultOrderByWithRelationInput[];

    const items = await this.client.cvAnalysisResult.findMany({
      where,
      include: { cvFileMetadata: true },
      orderBy,
      skip,
      take: query.limit
    });
    const total = await this.client.cvAnalysisResult.count({ where });

    return { items: items.map(mapCvAnalysisResult), total };
  }

  async findAnalysisResultByIdForUser(
    userId: string,
    analysisResultId: string
  ): Promise<CvAnalysisResultRecord | null> {
    const record = await this.client.cvAnalysisResult.findFirst({
      where: { id: analysisResultId, userId },
      include: { cvFileMetadata: true }
    });

    return record ? mapCvAnalysisResult(record) : null;
  }

  async findLatestAnalysisResultForUser(
    userId: string
  ): Promise<CvAnalysisResultRecord | null> {
    const record = await this.client.cvAnalysisResult.findFirst({
      where: { userId },
      include: { cvFileMetadata: true },
      orderBy: [{ analyzedAt: "desc" }, { id: "desc" }]
    });

    return record ? mapCvAnalysisResult(record) : null;
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
        deletedAt,
        isActive: false
      }
    });

    return result.count;
  }
}

async function createCvFileMetadataRecord(
  client: PrismaClientLike,
  input: {
    id: string;
    userId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    storageDriver: "LOCAL";
    storageKey: string;
    expiresAt: Date;
    isActive?: boolean;
  }
) {
  if (input.isActive) {
    await client.cvFileMetadata.updateMany({
      where: {
        userId: input.userId,
        deletedAt: null,
        isActive: true
      },
      data: {
        isActive: false
      }
    });
  }

  return client.cvFileMetadata.create({
    data: {
      id: input.id,
      userId: input.userId,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageDriver: input.storageDriver,
      storageKey: input.storageKey,
      expiresAt: input.expiresAt,
      isActive: input.isActive ?? false
    }
  });
}

function hasTransaction(client: PrismaClientLike): client is typeof prisma & {
  $transaction: <T>(
    fn: (transaction: PrismaTransaction) => Promise<T>
  ) => Promise<T>;
} {
  return "$transaction" in client;
}

function mapCvFileMetadata(record: {
  id: string;
  userId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageDriver: "LOCAL";
  storageKey: string;
  isActive: boolean;
  uploadedAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
}): CvFileMetadataRecord {
  return {
    id: record.id,
    userId: record.userId,
    originalFileName: record.originalFileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    storageDriver: record.storageDriver,
    storageKey: record.storageKey,
    isActive: record.isActive,
    uploadedAt: record.uploadedAt,
    expiresAt: record.expiresAt,
    deletedAt: record.deletedAt
  };
}

function createAnalysisResultWhere(
  userId: string,
  query: CvAnalysisResultListQuery
): Prisma.CvAnalysisResultWhereInput {
  return {
    userId,
    cvFileMetadataId: query.cvFileId,
    schemaVersion: query.schemaVersion,
    inputMode: query.inputMode,
    compareSource: query.compareSource
  };
}

function mapCvAnalysisResult(record: {
  id: string;
  userId: string;
  cvFileMetadataId: string | null;
  language: "ID" | "EN";
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  schemaVersion: string;
  overallImpression: string;
  jobFitAlignment: unknown;
  atsFriendliness: unknown;
  topActionables: unknown;
  sectionReviews: unknown;
  jobRecommendations: unknown;
  modelName: string | null;
  modelVersion: string | null;
  inputSummary: unknown;
  analyzedAt: Date;
  cvFileMetadata: {
    id: string;
    userId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    storageDriver: "LOCAL";
    storageKey: string;
    isActive: boolean;
    uploadedAt: Date;
    expiresAt: Date;
    deletedAt: Date | null;
  } | null;
}): CvAnalysisResultRecord {
  return {
    ...record,
    cvFileMetadata: record.cvFileMetadata
      ? mapCvFileMetadata(record.cvFileMetadata)
      : null
  };
}

function createInputSummary(input: CvAnalysisSnapshotInput) {
  return {
    requestId: input.payload.requestId,
    jobRoles: input.jobRoles,
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
