import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import { aiCvGenerateSuccessMessages } from "@/modules/ai-cv-generate/ai-cv-generate.constants";
import type { GenerateCvMarkdownInput } from "@/modules/ai-cv-generate/ai-cv-generate.schema";
import { AiCvGenerateService } from "@/modules/ai-cv-generate/ai-cv-generate.service";
import type { AiCvGenerateControllerDependencies } from "@/modules/ai-cv-generate/ai-cv-generate.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class AiCvGenerateController {
  private readonly service: AiCvGenerateService;
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: AiCvGenerateControllerDependencies
  ) {
    this.service = new AiCvGenerateService(dependencies.repository, {
      storage: dependencies.storage,
      genAiClient: dependencies.genAiClient,
      genAiEnabled: dependencies.config.integrations.aiCvGenerateGenAi.enabled,
      now: dependencies.now
    });
    this.now = dependencies.now ?? (() => new Date());
  }

  generateMarkdown = async (req: Request, res: Response) => {
    const startedAt = this.now();
    const input = req.body as GenerateCvMarkdownInput;
    const userId = req.auth?.userId ?? "";

    emitAuditEvent({
      action: "ai_cv_generate.requested",
      requestId: req.requestId,
      actorId: userId,
      resourceType: "cv-file",
      resourceId: input.cvFileId,
      result: "success"
    });

    try {
      const result = await this.service.generateMarkdown(
        userId,
        req.requestId,
        input
      );

      emitAuditEvent({
        action: "ai_cv_generate.completed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "cv-file",
        resourceId: input.cvFileId,
        result: "success",
        metadata: {
          markdownLength: result.markdown.length,
          durationMs: this.now().getTime() - startedAt.getTime()
        }
      });

      res
        .status(201)
        .json(
          successResponse(result, aiCvGenerateSuccessMessages.generated, null)
        );
    } catch (error) {
      emitAuditEvent({
        action: "ai_cv_generate.failed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "cv-file",
        resourceId: input.cvFileId,
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
