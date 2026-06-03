import { describe, expect, test } from "bun:test";
import { ZodError } from "zod";

import {
  asyncJobTypeSchema,
  parseAsyncJobPayload
} from "@/shared/async-workloads/async-workloads.schema";

describe("async workloads schema", () => {
  test("accepts known async job type enum values", () => {
    expect(asyncJobTypeSchema.parse("auth.email-verification")).toBe(
      "auth.email-verification"
    );
    expect(asyncJobTypeSchema.parse("auth.password-reset")).toBe(
      "auth.password-reset"
    );
    expect(asyncJobTypeSchema.parse("maintenance.cv-cleanup")).toBe(
      "maintenance.cv-cleanup"
    );
  });

  test("parses email verification payload", () => {
    const payload = parseAsyncJobPayload("auth.email-verification", {
      email: "user@example.com",
      otp: "123456",
      expiresAt: "2026-05-13T10:00:00.000Z"
    });

    expect(payload.email).toBe("user@example.com");
    expect(payload.otp).toBe("123456");
  });

  test("parses password reset payload", () => {
    const payload = parseAsyncJobPayload("auth.password-reset", {
      email: "user@example.com",
      token: "reset-token",
      expiresAt: "2026-05-13T10:00:00.000Z"
    });

    expect(payload.token).toBe("reset-token");
  });

  test("parses cv cleanup payload", () => {
    const payload = parseAsyncJobPayload("maintenance.cv-cleanup", {
      triggeredAt: "2026-05-13T10:00:00.000Z"
    });

    expect(payload.triggeredAt).toBe("2026-05-13T10:00:00.000Z");
  });

  test("rejects invalid payload shape", () => {
    try {
      parseAsyncJobPayload("auth.email-verification", {
        email: "user@example.com",
        otp: "12",
        expiresAt: "2026-05-13T10:00:00.000Z"
      });
      throw new Error("expected error");
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      if (error instanceof ZodError) {
        expect(error.issues[0]?.message).toBe("OTP must be 6 digits");
      }
    }

    expect(() =>
      parseAsyncJobPayload("maintenance.cv-cleanup", {
        triggeredAt: "not-an-iso-date"
      })
    ).toThrow(ZodError);
  });
});
