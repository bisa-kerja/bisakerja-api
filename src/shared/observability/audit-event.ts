import { logger } from "@/config/logger";
import { sanitizeSensitiveValue } from "@/shared/observability/redaction";
import type {
  AuditEventInput,
  AuditLogger
} from "@/shared/observability/audit-event.types";
export type { AuditEventInput } from "@/shared/observability/audit-event.types";

export function emitAuditEvent(
  event: AuditEventInput,
  auditLogger: AuditLogger = logger
) {
  auditLogger.info(
    {
      audit: true,
      event: event.action,
      requestId: event.requestId,
      actorId: event.actorId ?? null,
      resourceType: event.resourceType ?? null,
      resourceId: event.resourceId ?? null,
      result: event.result,
      metadata: sanitizeSensitiveValue(event.metadata ?? {})
    },
    "Audit event recorded"
  );
}

export function sanitizeAuditValue(value: unknown): unknown {
  return sanitizeSensitiveValue(value);
}
