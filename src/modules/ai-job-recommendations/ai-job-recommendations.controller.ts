import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import { aiJobRecommendationsSuccessMessages } from "@/modules/ai-job-recommendations/ai-job-recommendations.constants";
import type {
  GenerateJobRecommendationsInput,
  GetJobRecommendationsQueryInput,
  JobRecommendationRunParamsInput
} from "@/modules/ai-job-recommendations/ai-job-recommendations.schema";
import { AiJobRecommendationsService } from "@/modules/ai-job-recommendations/ai-job-recommendations.service";
import type { AiJobRecommendationsControllerDependencies } from "@/modules/ai-job-recommendations/ai-job-recommendations.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class AiJobRecommendationsController {
  private readonly service: AiJobRecommendationsService;
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: AiJobRecommendationsControllerDependencies
  ) {
    this.service = new AiJobRecommendationsService(dependencies.repository, {
      modelApiClient: dependencies.modelApiClient,
      now: dependencies.now
    });
    this.now = dependencies.now ?? (() => new Date());
  }

  generateRecommendations = async (req: Request, res: Response) => {
    const startedAt = this.now();
    const input = req.body as GenerateJobRecommendationsInput;
    const userId = req.auth?.userId ?? "";

    emitAuditEvent({
      action: "ai_job_recommendations.requested",
      requestId: req.requestId,
      actorId: userId,
      resourceType: "job-recommendations",
      resourceId: input.cvAnalysisResultId ?? "latest",
      result: "success",
      metadata: {
        limit: input.limit,
        hasIdempotencyKey: Boolean(input.idempotencyKey)
      }
    });

    try {
      const result = await this.service.generateRecommendations(
        userId,
        req.requestId,
        input
      );
      const durationMs = this.now().getTime() - startedAt.getTime();

      emitAuditEvent({
        action: "ai_job_recommendations.completed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "job-recommendations",
        resourceId: result.recommendationRun.id,
        result: "success",
        metadata: {
          recommendationCount: result.recommendationRun.recommendationCount,
          candidateCount: result.recommendationRun.candidateCount,
          modelVersion: result.recommendationRun.modelVersion,
          durationMs
        }
      });

      res
        .status(201)
        .json(
          successResponse(
            result,
            aiJobRecommendationsSuccessMessages.generated,
            null
          )
        );
    } catch (error) {
      emitAuditEvent({
        action: "ai_job_recommendations.failed",
        requestId: req.requestId,
        actorId: userId,
        resourceType: "job-recommendations",
        resourceId: input.cvAnalysisResultId ?? "latest",
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

  getLatestRecommendations = async (req: Request, res: Response) => {
    const userId = req.auth?.userId ?? "";
    const query = req.query as unknown as GetJobRecommendationsQueryInput;
    const result = await this.service.getLatestRecommendations(userId, query);

    res.json(
      successResponse(
        result,
        aiJobRecommendationsSuccessMessages.latestRetrieved,
        null
      )
    );
  };

  getRecommendationRunDetail = async (req: Request, res: Response) => {
    const userId = req.auth?.userId ?? "";
    const params = req.params as JobRecommendationRunParamsInput;
    const query = req.query as unknown as GetJobRecommendationsQueryInput;
    const result = await this.service.getRecommendationRunDetail(
      userId,
      params.recommendationRunId,
      query
    );

    res.json(
      successResponse(
        result,
        aiJobRecommendationsSuccessMessages.detailRetrieved,
        null
      )
    );
  };
}
