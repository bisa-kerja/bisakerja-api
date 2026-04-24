import { ConflictError, NotFoundError } from "@/core/errors/app.error";
import {
  allowedStatusTransitions,
  applicationsErrorCodes
} from "@/modules/applications/applications.constants";
import type {
  CreateApplicationInput,
  ListApplicationsQueryInput,
  UpdateApplicationInput,
  UpdateApplicationStatusInput
} from "@/modules/applications/applications.schema";
import type {
  ApplicationRecord,
  ApplicationsRepository,
  ApplicationsServiceOptions,
  ApplicationStatus,
  UpdateApplicationStatusResult
} from "@/modules/applications/applications.types";
import {
  serializeJobCard,
  serializeProvidedFilters
} from "@/modules/jobs/jobs.mapper";

export class ApplicationsService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly options: ApplicationsServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async listApplications(userId: string, query: ListApplicationsQueryInput) {
    const result = await this.repository.listForUser(userId, query);
    const totalPages = Math.ceil(result.total / query.limit);
    const now = this.now();

    return {
      data: result.items.map((application) =>
        serializeApplicationResource(
          application,
          this.options.staleAfterHours,
          now
        )
      ),
      meta: {
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPrevPage: query.page > 1
        },
        filters: serializeProvidedFilters({
          keyword: query.keyword,
          status: query.status
        }),
        sort: query.sort
      }
    };
  }

  async createApplication(userId: string, input: CreateApplicationInput) {
    const job = await this.repository.findTrackableJobById(input.jobId);

    if (!job) {
      throw new NotFoundError(
        "Job not found",
        applicationsErrorCodes.jobNotFound
      );
    }

    if (input.status !== "APPLIED") {
      throw new ConflictError(
        "Invalid initial application status",
        applicationsErrorCodes.applicationStatusConflict
      );
    }

    const existing = await this.repository.findByUserAndJob(
      userId,
      input.jobId
    );

    if (existing) {
      throw new ConflictError(
        "Application already tracked",
        applicationsErrorCodes.applicationAlreadyTracked
      );
    }

    return serializeApplicationResource(
      await this.repository.createForUser(userId, input),
      this.options.staleAfterHours,
      this.now()
    );
  }

  async updateApplication(
    userId: string,
    applicationId: string,
    input: UpdateApplicationInput
  ) {
    const application = await this.repository.updateForUser(
      userId,
      applicationId,
      input
    );

    if (!application) {
      throw new NotFoundError(
        "Application not found",
        applicationsErrorCodes.applicationNotFound
      );
    }

    return serializeApplicationResource(
      application,
      this.options.staleAfterHours,
      this.now()
    );
  }

  async updateApplicationStatus(
    userId: string,
    applicationId: string,
    input: UpdateApplicationStatusInput
  ): Promise<UpdateApplicationStatusResult> {
    const application = await this.repository.findByIdForUser(
      userId,
      applicationId
    );

    if (!application) {
      throw new NotFoundError(
        "Application not found",
        applicationsErrorCodes.applicationNotFound
      );
    }

    if (!canTransition(application.status, input.status)) {
      throw new ConflictError(
        "Invalid application status transition",
        applicationsErrorCodes.applicationStatusConflict,
        {
          fromStatus: application.status,
          toStatus: input.status
        }
      );
    }

    const updated = await this.repository.updateStatusForUser(
      userId,
      applicationId,
      input,
      application.status
    );

    if (!updated) {
      throw new NotFoundError(
        "Application not found",
        applicationsErrorCodes.applicationNotFound
      );
    }

    return {
      application: serializeApplicationResource(
        updated,
        this.options.staleAfterHours,
        this.now()
      ),
      previousStatus: application.status
    };
  }
}

export function canTransition(
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus
): boolean {
  return allowedStatusTransitions[fromStatus].includes(toStatus as never);
}

export function serializeApplicationResource(
  application: ApplicationRecord,
  staleAfterHours: number,
  now: Date
) {
  return {
    id: application.id,
    status: application.status,
    notes: application.notes,
    source: application.source,
    appliedAt: application.appliedAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    job: serializeJobCard(application.job, staleAfterHours, now)
  };
}
