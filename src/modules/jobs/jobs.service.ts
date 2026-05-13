import { NotFoundError } from "@/core/errors/app.error";
import { jobsErrorCodes } from "@/modules/jobs/jobs.constants";
import type { ListJobsQueryInput } from "@/modules/jobs/jobs.schema";
import {
  serializeJobCard,
  serializeJobDetail
} from "@/shared/utils/job-presentation";
import { serializeProvidedFilters } from "@/shared/utils/filters";
import type {
  JobsRepository,
  JobsServiceOptions
} from "@/modules/jobs/jobs.types";

export class JobsService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: JobsRepository,
    private readonly options: JobsServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async listJobs(query: ListJobsQueryInput) {
    const result = await this.repository.listJobs(query);
    const totalPages = Math.ceil(result.total / query.limit);
    const now = this.now();

    return {
      data: result.items.map((job) =>
        serializeJobCard(job, this.options.staleAfterHours, now)
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
          location: query.location,
          province: query.province,
          city: query.city,
          workType: query.workType,
          employmentType: query.employmentType,
          experienceLevel: query.experienceLevel,
          salaryMin: query.salaryMin,
          salaryMax: query.salaryMax,
          sourcePlatform: query.sourcePlatform,
          skill: query.skill,
          category: query.category
        }),
        sort:
          query.sort === "relevance" && !query.keyword ? "newest" : query.sort
      }
    };
  }

  async getJobDetail(jobId: string) {
    const job = await this.repository.findVisibleById(jobId);

    if (!job) {
      throw new NotFoundError(
        "Lowongan tidak ditemukan",
        jobsErrorCodes.jobNotFound
      );
    }

    return serializeJobDetail(job, this.options.staleAfterHours, this.now());
  }
}
