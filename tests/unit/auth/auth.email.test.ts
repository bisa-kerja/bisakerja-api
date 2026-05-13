import { describe, expect, test } from "bun:test";

import {
  AuthEmailProvider,
  buildAuthEmailIdempotencyKey,
  createAuthEmailProvider
} from "@/modules/auth/auth.email";
import type { SendEmailInput, SendEmailResult } from "@/shared/email";
import { testConfig } from "../../helpers/config";

describe("auth email provider", () => {
  test("sends verification email payload with OTP and idempotency key", async () => {
    const recorder = new RecordingEmailService();
    const config = testConfig({
      APP_NAME: "Bisakerja API Test",
      EMAIL_PROVIDER: "fake"
    });
    const provider = new AuthEmailProvider(config, recorder);
    const expiresAt = new Date("2026-05-13T10:00:00.000Z");

    await provider.sendEmailVerification({
      email: "user@example.com",
      otp: "123456",
      expiresAt
    });

    expect(recorder.sent).toHaveLength(1);
    const email = recorder.sent[0];
    expect(email?.to).toBe("user@example.com");
    expect(email?.subject).toBe("Verify your Bisakerja email");
    expect(email?.html).toContain("123456");
    expect(email?.text).toContain("123456");
    expect(email?.tags).toEqual([
      { name: "category", value: "auth-email-verification" }
    ]);
    expect(email?.idempotencyKey?.startsWith("auth-email-verification/")).toBe(
      true
    );
  });

  test("sends password reset email with frontend reset URL", async () => {
    const recorder = new RecordingEmailService();
    const config = testConfig({
      FRONTEND_URL: "https://app.bisakerja.example"
    });
    const provider = new AuthEmailProvider(config, recorder);
    const expiresAt = new Date("2026-05-13T10:00:00.000Z");

    await provider.sendPasswordReset({
      email: "user@example.com",
      token: "reset-token-123",
      expiresAt
    });

    expect(recorder.sent).toHaveLength(1);
    const email = recorder.sent[0];
    expect(email?.subject).toBe("Reset your Bisakerja password");
    expect(email?.html).toContain(
      "https://app.bisakerja.example/reset-password?token=reset-token-123"
    );
    expect(email?.text).toContain("reset-token-123");
    expect(email?.tags).toEqual([
      { name: "category", value: "auth-password-reset" }
    ]);
    expect(email?.idempotencyKey?.startsWith("auth-password-reset/")).toBe(
      true
    );
  });

  test("builds deterministic auth email idempotency key", () => {
    const expiresAt = new Date("2026-05-13T10:00:00.000Z");

    const keyA = buildAuthEmailIdempotencyKey(
      "auth-email-verification",
      "user@example.com",
      expiresAt
    );
    const keyB = buildAuthEmailIdempotencyKey(
      "auth-email-verification",
      "user@example.com",
      expiresAt
    );
    const keyC = buildAuthEmailIdempotencyKey(
      "auth-password-reset",
      "user@example.com",
      expiresAt
    );

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(keyA.split("/")[1]?.length).toBe(32);
  });

  test("creates auth email provider from app config", () => {
    const provider = createAuthEmailProvider(
      testConfig({
        EMAIL_PROVIDER: "fake"
      })
    );

    expect(provider).toBeInstanceOf(AuthEmailProvider);
  });
});

class RecordingEmailService {
  readonly sent: SendEmailInput[] = [];

  send(input: SendEmailInput): Promise<SendEmailResult> {
    this.sent.push(input);

    return Promise.resolve({
      provider: "fake",
      messageId: null,
      acceptedAt: new Date("2026-05-13T10:00:00.000Z"),
      idempotencyKey: input.idempotencyKey ?? null
    });
  }
}
