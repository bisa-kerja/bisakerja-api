import { describe, expect, test } from "bun:test";

import {
  DownstreamError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import { FakeEmailService } from "@/shared/email";
import { ResendEmailService } from "@/shared/email";
import { testConfig } from "../../helpers/config";

describe("FakeEmailService", () => {
  test("returns a normalized send result without external delivery", async () => {
    const service = new FakeEmailService();

    const result = await service.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      idempotencyKey: "auth-email-verification/abc123"
    });

    expect(result.provider).toBe("fake");
    expect(result.messageId).toBeNull();
    expect(result.idempotencyKey).toBe("auth-email-verification/abc123");
  });
});

describe("ResendEmailService", () => {
  test("retries transient resend errors using retry-after and preserves idempotency key", async () => {
    const calls: { idempotencyKey?: string }[] = [];
    const sleeps: number[] = [];
    const config = testConfig({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_123",
      RESEND_MAX_RETRIES: "2"
    });
    const service = new ResendEmailService(config, {
      client: {
        emails: {
          send: (_payload, options) => {
            calls.push({ idempotencyKey: options?.idempotencyKey });

            if (calls.length === 1) {
              return Promise.resolve({
                data: null,
                error: {
                  message: "Too many requests",
                  name: "rate_limit_exceeded",
                  statusCode: 429
                },
                headers: {
                  "retry-after": "2"
                }
              });
            }

            return Promise.resolve({
              data: { id: "email_123" },
              error: null,
              headers: null
            });
          }
        }
      },
      sleep: (durationMs) => {
        sleeps.push(durationMs);
        return Promise.resolve();
      },
      now: () => new Date("2026-04-24T10:00:00.000Z")
    });

    const result = await service.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      idempotencyKey: "auth-email-verification/abc123"
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.idempotencyKey).toBe("auth-email-verification/abc123");
    expect(calls[1]?.idempotencyKey).toBe("auth-email-verification/abc123");
    expect(sleeps).toEqual([2000]);
    expect(result.messageId).toBe("email_123");
    expect(result.provider).toBe("resend");
  });

  test("maps non-retryable resend errors to downstream failures", async () => {
    const config = testConfig({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_123"
    });
    const service = new ResendEmailService(config, {
      client: {
        emails: {
          send: () =>
            Promise.resolve({
              data: null,
              error: {
                message: "API key is invalid",
                name: "invalid_api_key",
                statusCode: 403
              },
              headers: null
            })
        }
      }
    });

    try {
      await service.send({
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>"
      });
      throw new Error("Expected email send to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DownstreamError);
    }
  });

  test("maps repeated runtime failures to service unavailable", async () => {
    const sleeps: number[] = [];
    const config = testConfig({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_123",
      RESEND_MAX_RETRIES: "1"
    });
    const service = new ResendEmailService(config, {
      client: {
        emails: {
          send: () => Promise.reject(new Error("socket hang up"))
        }
      },
      sleep: (durationMs) => {
        sleeps.push(durationMs);
        return Promise.resolve();
      }
    });

    try {
      await service.send({
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>"
      });
      throw new Error("Expected email send to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    }

    expect(sleeps).toEqual([500]);
  });
});
