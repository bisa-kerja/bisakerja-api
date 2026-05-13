import type { Request, Response } from "express";

import {
  listResponse,
  successResponse
} from "@/core/responses/response.formatter";
import type { ListJobsQueryInput } from "@/modules/jobs/jobs.schema";
import { JobsService } from "@/modules/jobs/jobs.service";
import type { JobsControllerDependencies } from "@/modules/jobs/jobs.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class JobsController {
  private readonly service: JobsService;

  constructor(private readonly dependencies: JobsControllerDependencies) {
    this.service = new JobsService(dependencies.repository, {
      staleAfterHours: dependencies.config.jobs.staleAfterHours,
      now: dependencies.now
    });
  }

  listJobs = async (req: Request, res: Response) => {
    const query = req.query as unknown as ListJobsQueryInput;
    const result = await this.service.listJobs(query);

    emitAuditEvent({
      action: "jobs.list_requested",
      requestId: req.requestId,
      resourceType: "job_listing",
      result: "success",
      metadata: {
        keywordPresent: Boolean(query.keyword),
        filters: result.meta.filters,
        sort: result.meta.sort,
        page: result.meta.pagination.page,
        limit: result.meta.pagination.limit,
        resultCount: result.data.length
      }
    });

    res.json(
      listResponse(result.data, result.meta, "Daftar lowongan berhasil diambil")
    );
  };

  getJobDetail = async (req: Request, res: Response) => {
    const params = req.params as { jobId: string };
    const job = await this.service.getJobDetail(params.jobId);

    emitAuditEvent({
      action: "jobs.detail_requested",
      requestId: req.requestId,
      resourceType: "job_listing",
      resourceId: job.id,
      result: "success"
    });

    res.json(successResponse(job, "Lowongan berhasil diambil"));
  };
}
