import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import { aiJobFitSuccessMessages } from "@/modules/ai-job-fit/ai-job-fit.constants";
import type { AnalyzeJobFitInput } from "@/modules/ai-job-fit/ai-job-fit.schema";
import { AiJobFitService } from "@/modules/ai-job-fit/ai-job-fit.service";
import type { AiJobFitControllerDependencies } from "@/modules/ai-job-fit/ai-job-fit.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class AiJobFitController {
  private readonly service: AiJobFitService;
  private readonly now: () => Date;

  constructor(private readonly dependencies: AiJobFitControllerDependencies) {
    this.service = new AiJobFitService(dependencies.repository, {
      modelApiClient: dependencies.modelApiClient
    });
    this.now = dependencies.now ?? (() => new Date());
  }

  analyzeJobFit = async (req: Request, res: Response) => {
    const startedAt = this.now();
    const input = req.body as AnalyzeJobFitInput;
    const userId = req.auth?.userId ?? "";

    emitAuditEvent({
      action: "ai_job_fit.requested",
      requestId: req.requestId,
      actorId: userId,
      resourceType: "job-fit",
      resourceId: input.jobId,
      result: "success",
      metadata: {
        persistResult: input.persistResult
      }
    });

    try {
      const result = await this.service.analyzeJobFit(
        userId,
        req.requestId,
        input
      );
      const durationMs = this.now().getTime() - startedAt.getTime();

      emitAuditEvent({
        action: "ai_job_fit.completed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "job-fit",
        resourceId: input.jobId,
        result: "success",
        metadata: {
          fitScore: result.resource.fitScore,
          modelVersion: result.resource.model.version,
          durationMs
        }
      });

      if (result.persisted) {
        emitAuditEvent({
          action: "ai_job_fit.persisted",
          requestId: req.requestId,
          actorId: userId,
          resourceType: "job-fit",
          resourceId: input.jobId,
          result: "success",
          metadata: {
            fitScore: result.resource.fitScore,
            modelVersion: result.resource.model.version
          }
        });
      }

      res.json(
        successResponse(
          result.resource,
          aiJobFitSuccessMessages.completed,
          null
        )
      );
    } catch (error) {
      emitAuditEvent({
        action: "ai_job_fit.failed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "job-fit",
        resourceId: input.jobId,
        result: "failure",
        metadata: {
          errorCode:
            error instanceof Error && "code" in error ? error.code : "UNKNOWN",
          durationMs: this.now().getTime() - startedAt.getTime()
        }
      });

      throw error;
    }
  };
}
