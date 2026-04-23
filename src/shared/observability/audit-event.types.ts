import type { logger } from "@/config/logger";

export type AuditLogger = Pick<typeof logger, "info">;

export type AuditEventInput = {
  action: string;
  requestId: string;
  result: "success" | "failure";
  actorId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};
