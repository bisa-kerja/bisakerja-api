import type {
  NotificationEventsInput,
  ScraperJobsSyncInput
} from "@/modules/internal/internal.schema";
import type { InternalRepository } from "@/modules/internal/internal.types";

export class InternalService {
  constructor(private readonly repository: InternalRepository) {}

  syncScraperJobs(input: ScraperJobsSyncInput) {
    return this.repository.syncScraperJobs(input);
  }

  acceptNotificationEvents(input: NotificationEventsInput) {
    return this.repository.acceptNotificationEvents(input);
  }
}
