import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import type {
  NotificationEventsInput,
  ScraperJobsSyncInput
} from "@/modules/internal/internal.schema";
import { InternalService } from "@/modules/internal/internal.service";
import type { InternalControllerDependencies } from "@/modules/internal/internal.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class InternalController {
  private readonly service: InternalService;

  constructor(dependencies: InternalControllerDependencies) {
    this.service = new InternalService(dependencies.repository);
  }

  syncScraperJobs = async (req: Request, res: Response) => {
    const input = req.body as ScraperJobsSyncInput;
    const result = await this.service.syncScraperJobs(input);

    emitAuditEvent({
      action: "internal.scraper_jobs_synced",
      requestId: req.requestId,
      resourceType: "job_listing",
      result: "success",
      metadata: {
        accepted: result.accepted,
        upserted: result.upserted
      }
    });

    res.json(successResponse(result, "Scraper jobs synced successfully"));
  };

  acceptNotificationEvents = async (req: Request, res: Response) => {
    const input = req.body as NotificationEventsInput;
    const result = await this.service.acceptNotificationEvents(input);

    emitAuditEvent({
      action: "internal.notification_events_accepted",
      requestId: req.requestId,
      resourceType: "notification_event",
      result: "success",
      metadata: {
        runId: result.runId,
        accepted: result.accepted
      }
    });

    res.json(successResponse(result, "Event notifikasi diterima"));
  };
}
