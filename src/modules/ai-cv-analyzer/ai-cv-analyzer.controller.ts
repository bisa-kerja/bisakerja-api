import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import { aiCvAnalyzerSuccessMessages } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.constants";
import type { AnalyzeCvInput } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.schema";
import { AiCvAnalyzerService } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.service";
import type { AiCvAnalyzerControllerDependencies } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class AiCvAnalyzerController {
  private readonly service: AiCvAnalyzerService;
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: AiCvAnalyzerControllerDependencies
  ) {
    this.service = new AiCvAnalyzerService(dependencies.repository, {
      modelApiClient: dependencies.modelApiClient,
      storage: dependencies.storage,
      cvRetentionDays: dependencies.config.uploads.cvRetentionDays,
      now: dependencies.now
    });
    this.now = dependencies.now ?? (() => new Date());
  }

  analyzeCv = async (req: Request, res: Response) => {
    const startedAt = this.now();
    const input = req.body as AnalyzeCvInput;
    const userId = req.auth?.userId ?? "";

    emitAuditEvent({
      action: "ai_cv_analyzer.requested",
      requestId: req.requestId,
      actorId: userId,
      resourceType: "cv-analysis",
      resourceId: input.jobId,
      result: "success",
      metadata: {
        inputMode: input.inputMode,
        compareSource: input.compareSource,
        persistResult: input.persistResult
      }
    });

    try {
      const result = await this.service.analyzeCv(
        userId,
        req.requestId,
        input,
        req.file
          ? {
              originalName: req.file.originalname,
              mimeType: req.file.mimetype,
              sizeBytes: req.file.size,
              buffer: req.file.buffer
            }
          : null
      );
      const durationMs = this.now().getTime() - startedAt.getTime();

      emitAuditEvent({
        action: "ai_cv_analyzer.completed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "cv-analysis",
        resourceId: input.jobId,
        result: "success",
        metadata: {
          cvFileMetadataId: result.cvFileMetadataId,
          modelVersion: result.resource.model.version,
          durationMs
        }
      });

      if (result.persisted) {
        emitAuditEvent({
          action: "ai_cv_analyzer.persisted",
          requestId: req.requestId,
          actorId: userId,
          resourceType: "cv-analysis",
          resourceId: input.jobId,
          result: "success",
          metadata: {
            cvFileMetadataId: result.cvFileMetadataId,
            modelVersion: result.resource.model.version
          }
        });
      }

      res.json(
        successResponse(
          result.resource,
          aiCvAnalyzerSuccessMessages.completed,
          null
        )
      );
    } catch (error) {
      emitAuditEvent({
        action: "ai_cv_analyzer.failed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "cv-analysis",
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
