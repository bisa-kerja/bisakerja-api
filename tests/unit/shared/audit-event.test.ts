import { describe, expect, test } from "bun:test";

import {
  emitAuditEvent,
  sanitizeAuditValue
} from "@/shared/observability/audit-event";

describe("audit event helper", () => {
  test("redacts sensitive metadata keys recursively", () => {
    expect(
      sanitizeAuditValue({
        password: "plain",
        profile: {
          displayName: "Test User",
          refreshToken: "token-value"
        },
        files: [
          {
            fileMetadataId: "cv_123",
            rawCvContent: "private cv text"
          }
        ]
      })
    ).toEqual({
      password: "[REDACTED]",
      profile: {
        displayName: "Test User",
        refreshToken: "[REDACTED]"
      },
      files: [
        {
          fileMetadataId: "cv_123",
          rawCvContent: "[REDACTED]"
        }
      ]
    });
  });

  test("emits a structured audit log without raw sensitive values", () => {
    const entries: unknown[] = [];

    emitAuditEvent(
      {
        action: "auth.login_failed",
        requestId: "req_audit_123",
        actorId: null,
        resourceType: "user",
        resourceId: null,
        result: "failure",
        metadata: {
          failureCategory: "invalid_credentials",
          password: "plain",
          otp: "123456"
        }
      },
      {
        info: (fields: unknown, message?: string) => {
          entries.push({ fields, message });
        }
      }
    );

    expect(entries).toEqual([
      {
        fields: {
          audit: true,
          event: "auth.login_failed",
          requestId: "req_audit_123",
          actorId: null,
          resourceType: "user",
          resourceId: null,
          result: "failure",
          metadata: {
            failureCategory: "invalid_credentials",
            password: "[REDACTED]",
            otp: "[REDACTED]"
          }
        },
        message: "Audit event recorded"
      }
    ]);

    const serializedLog = JSON.stringify(entries);
    expect(serializedLog).not.toContain("plain");
    expect(serializedLog).not.toContain("123456");
  });
});
