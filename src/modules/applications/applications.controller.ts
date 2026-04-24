import type { Request, Response } from "express";

import {
  createdResponse,
  listResponse,
  successResponse
} from "@/core/responses/response.formatter";
import { applicationsErrorCodes } from "@/modules/applications/applications.constants";
import type {
  CreateApplicationInput,
  ListApplicationsQueryInput,
  UpdateApplicationInput,
  UpdateApplicationStatusInput
} from "@/modules/applications/applications.schema";
import { ApplicationsService } from "@/modules/applications/applications.service";
import type { ApplicationsControllerDependencies } from "@/modules/applications/applications.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class ApplicationsController {
  private readonly service: ApplicationsService;

  constructor(dependencies: ApplicationsControllerDependencies) {
    this.service = new ApplicationsService(dependencies.repository, {
      staleAfterHours: dependencies.config.jobs.staleAfterHours,
      now: dependencies.now
    });
  }

  listApplications = async (req: Request, res: Response) => {
    const query = req.query as unknown as ListApplicationsQueryInput;
    const result = await this.service.listApplications(
      req.auth?.userId ?? "",
      query
    );

    emitAuditEvent({
      action: "applications.list_requested",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "application",
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
      listResponse(
        result.data,
        result.meta,
        "Applications retrieved successfully"
      )
    );
  };

  createApplication = async (req: Request, res: Response) => {
    const input = req.body as CreateApplicationInput;
    let application;

    try {
      application = await this.service.createApplication(
        req.auth?.userId ?? "",
        input
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === applicationsErrorCodes.applicationAlreadyTracked
      ) {
        emitAuditEvent({
          action: "applications.duplicate_rejected",
          requestId: req.requestId,
          actorId: req.auth?.userId,
          resourceType: "application",
          result: "failure",
          metadata: {
            jobId: input.jobId
          }
        });
      }

      throw error;
    }

    emitAuditEvent({
      action: "applications.created",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "application",
      resourceId: application.id,
      result: "success",
      metadata: {
        jobId: input.jobId,
        status: application.status,
        source: application.source
      }
    });

    res
      .status(201)
      .json(createdResponse(application, "Application created successfully"));
  };

  updateApplication = async (req: Request, res: Response) => {
    const params = req.params as { applicationId: string };
    const input = req.body as UpdateApplicationInput;
    const application = await this.service.updateApplication(
      req.auth?.userId ?? "",
      params.applicationId,
      input
    );

    emitAuditEvent({
      action: "applications.updated",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "application",
      resourceId: application.id,
      result: "success",
      metadata: {
        source: application.source,
        notesUpdated: input.notes !== undefined
      }
    });

    res.json(
      successResponse(application, "Application updated successfully", null)
    );
  };

  updateApplicationStatus = async (req: Request, res: Response) => {
    const params = req.params as { applicationId: string };
    const input = req.body as UpdateApplicationStatusInput;
    const userId = req.auth?.userId ?? "";
    const result = await this.service.updateApplicationStatus(
      userId,
      params.applicationId,
      input
    );

    emitAuditEvent({
      action: "applications.status_updated",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "application",
      resourceId: result.application.id,
      result: "success",
      metadata: {
        fromStatus: result.previousStatus,
        toStatus: result.application.status
      }
    });

    res.json(
      successResponse(
        result.application,
        "Application status updated successfully",
        null
      )
    );
  };
}
