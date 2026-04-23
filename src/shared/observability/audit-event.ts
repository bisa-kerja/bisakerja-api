import { logger } from "@/config/logger";
import type {
  AuditEventInput,
  AuditLogger
} from "@/shared/observability/audit-event.types";
export type { AuditEventInput } from "@/shared/observability/audit-event.types";

const sensitiveKeyPattern =
  /password|token|otp|secret|authorization|cookie|credential|cvContent|rawPayload|rawModel|rawScraper|databaseUrl|DATABASE_URL/i;

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
      metadata: sanitizeAuditValue(event.metadata ?? {})
    },
    "Audit event recorded"
  );
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitizeAuditValue(entry)
      ])
    );
  }

  return value;
}
