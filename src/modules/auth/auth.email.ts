import { createHash } from "node:crypto";

import type { AppConfig } from "@/config/env";
import type { EmailProvider } from "@/modules/auth/auth.types";
import type { EmailService } from "@/shared/email";
import { createEmailService } from "@/shared/email";

export class AuthEmailProvider implements EmailProvider {
  constructor(
    private readonly config: AppConfig,
    private readonly emailService: EmailService
  ) {}

  async sendEmailVerification(input: {
    email: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.emailService.send({
      to: input.email,
      subject: "Verify your Bisakerja email",
      html: renderEmailVerificationHtml(this.config, input),
      text: renderEmailVerificationText(this.config, input),
      tags: [{ name: "category", value: "auth-email-verification" }],
      idempotencyKey: buildAuthEmailIdempotencyKey(
        "auth-email-verification",
        input.email,
        input.expiresAt
      )
    });
  }

  async sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const resetUrl = buildPasswordResetUrl(this.config, input.token);

    await this.emailService.send({
      to: input.email,
      subject: "Reset your Bisakerja password",
      html: renderPasswordResetHtml(this.config, {
        expiresAt: input.expiresAt,
        resetUrl
      }),
      text: renderPasswordResetText(this.config, {
        expiresAt: input.expiresAt,
        resetUrl
      }),
      tags: [{ name: "category", value: "auth-password-reset" }],
      idempotencyKey: buildAuthEmailIdempotencyKey(
        "auth-password-reset",
        input.email,
        input.expiresAt
      )
    });
  }
}

export function createAuthEmailProvider(config: AppConfig): EmailProvider {
  return new AuthEmailProvider(config, createEmailService(config));
}

function buildPasswordResetUrl(config: AppConfig, token: string) {
  const url = new URL("/reset-password", config.app.frontendUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildAuthEmailIdempotencyKey(
  eventType: "auth-email-verification" | "auth-password-reset",
  email: string,
  expiresAt: Date
) {
  const fingerprint = createHash("sha256")
    .update(`${email}:${expiresAt.toISOString()}`)
    .digest("hex")
    .slice(0, 32);

  return `${eventType}/${fingerprint}`;
}

function formatExpiry(expiresAt: Date) {
  return expiresAt.toISOString();
}

function renderEmailVerificationHtml(
  config: AppConfig,
  input: {
    otp: string;
    expiresAt: Date;
  }
) {
  return [
    `<p>Hello from ${config.app.name},</p>`,
    "<p>Use the verification code below to confirm your email address.</p>",
    `<p><strong style="font-size:24px;letter-spacing:4px;">${input.otp}</strong></p>`,
    `<p>This code expires at ${formatExpiry(input.expiresAt)}.</p>`,
    "<p>If you did not create this account, you can ignore this email.</p>"
  ].join("");
}

function renderEmailVerificationText(
  config: AppConfig,
  input: {
    otp: string;
    expiresAt: Date;
  }
) {
  return [
    `Hello from ${config.app.name},`,
    "",
    "Use this verification code to confirm your email address:",
    input.otp,
    "",
    `This code expires at ${formatExpiry(input.expiresAt)}.`,
    "If you did not create this account, you can ignore this email."
  ].join("\n");
}

function renderPasswordResetHtml(
  config: AppConfig,
  input: {
    expiresAt: Date;
    resetUrl: string;
  }
) {
  return [
    `<p>Hello from ${config.app.name},</p>`,
    "<p>We received a request to reset your password.</p>",
    `<p><a href="${input.resetUrl}">Reset your password</a></p>`,
    `<p>This link expires at ${formatExpiry(input.expiresAt)}.</p>`,
    "<p>If you did not request a password reset, you can ignore this email.</p>"
  ].join("");
}

function renderPasswordResetText(
  config: AppConfig,
  input: {
    expiresAt: Date;
    resetUrl: string;
  }
) {
  return [
    `Hello from ${config.app.name},`,
    "",
    "We received a request to reset your password.",
    `Reset URL: ${input.resetUrl}`,
    "",
    `This link expires at ${formatExpiry(input.expiresAt)}.`,
    "If you did not request a password reset, you can ignore this email."
  ].join("\n");
}
