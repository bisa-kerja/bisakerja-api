import { Resend } from "resend";

import type { AppConfig } from "@/config/env";
import { logger } from "@/config/logger";
import {
  AppError,
  DownstreamError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import type {
  EmailService,
  ResendClient,
  SendEmailInput,
  SendEmailResult
} from "@/shared/email/email.types";

type ResendEmailServiceDependencies = {
  client?: ResendClient;
  sleep?: (durationMs: number) => Promise<void>;
  now?: () => Date;
};

type ResendErrorDetails = {
  message: string;
  name: string;
  statusCode: number | null;
};

const retryableErrorNames = new Set([
  "rate_limit_exceeded",
  "application_error",
  "internal_server_error",
  "concurrent_idempotent_requests"
]);

export class ResendEmailService implements EmailService {
  private readonly client: ResendClient;
  private readonly sleep: (durationMs: number) => Promise<void>;
  private readonly now: () => Date;

  constructor(
    private readonly config: AppConfig,
    dependencies: ResendEmailServiceDependencies = {}
  ) {
    this.client =
      dependencies.client ?? new Resend(this.config.email.resend.apiKey);
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.now = dependencies.now ?? (() => new Date());
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const payload = {
      from: input.from ?? this.config.email.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
      tags: input.tags
    };
    const options = input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey }
      : undefined;
    const maxRetries = this.config.email.resend.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await this.client.emails.send(payload, options);

        if (!response.error && response.data) {
          return {
            provider: "resend",
            messageId: response.data.id,
            acceptedAt: this.now(),
            idempotencyKey: input.idempotencyKey ?? null
          };
        }

        const resendError = toResendErrorDetails(response.error);
        const retryAfterMs = resolveRetryAfterMs(response.headers);
        const retryable = isRetryableResendError(resendError);

        if (retryable && attempt < maxRetries) {
          const delayMs = retryAfterMs ?? calculateBackoffDelayMs(attempt);
          logRetry({
            attempt,
            delayMs,
            error: resendError,
            input
          });
          await this.sleep(delayMs);
          continue;
        }

        throw createEmailDeliveryError(resendError, retryable);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        if (!isRetryableRuntimeError(error) || attempt >= maxRetries) {
          throw createRuntimeDeliveryError(error);
        }

        const delayMs = calculateBackoffDelayMs(attempt);
        logger.warn(
          {
            provider: "resend",
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            delayMs,
            recipientCount: recipientCount(input.to)
          },
          "Retrying email delivery after transient runtime failure"
        );
        await this.sleep(delayMs);
      }
    }

    throw new ServiceUnavailableError(
      "Email delivery is temporarily unavailable",
      "EMAIL_DELIVERY_UNAVAILABLE"
    );
  }
}

function toResendErrorDetails(
  error: { message: string; name: string; statusCode: number | null } | null
): ResendErrorDetails {
  return (
    error ?? {
      message: "Unknown Resend error",
      name: "application_error",
      statusCode: 500
    }
  );
}

function isRetryableResendError(error: ResendErrorDetails) {
  if (error.statusCode === 500) {
    return true;
  }

  if (error.statusCode === 429 && error.name === "rate_limit_exceeded") {
    return true;
  }

  return retryableErrorNames.has(error.name);
}

function isRetryableRuntimeError(error: unknown) {
  return error instanceof Error;
}

function createEmailDeliveryError(
  error: ResendErrorDetails,
  retryable: boolean
) {
  const details = {
    provider: "resend",
    providerErrorCode: error.name,
    providerStatusCode: error.statusCode,
    retryable
  };

  if (retryable) {
    return new ServiceUnavailableError(
      "Email delivery is temporarily unavailable",
      "EMAIL_DELIVERY_UNAVAILABLE",
      details
    );
  }

  return new DownstreamError(
    "Email delivery failed",
    "EMAIL_DELIVERY_FAILED",
    details
  );
}

function createRuntimeDeliveryError(error: unknown) {
  return new ServiceUnavailableError(
    "Email delivery is temporarily unavailable",
    "EMAIL_DELIVERY_UNAVAILABLE",
    {
      provider: "resend",
      retryable: true,
      cause: error instanceof Error ? error.message : "Unknown runtime error"
    }
  );
}

function resolveRetryAfterMs(headers: Record<string, string> | null) {
  const retryAfter = headers?.["retry-after"];

  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return seconds * 1000;
}

function calculateBackoffDelayMs(attempt: number) {
  const baseDelayMs = 500;
  return baseDelayMs * 2 ** attempt;
}

function recipientCount(value: string | string[]) {
  return Array.isArray(value) ? value.length : 1;
}

function logRetry(input: {
  attempt: number;
  delayMs: number;
  error: ResendErrorDetails;
  input: SendEmailInput;
}) {
  logger.warn(
    {
      provider: "resend",
      attempt: input.attempt + 1,
      delayMs: input.delayMs,
      providerErrorCode: input.error.name,
      providerStatusCode: input.error.statusCode,
      recipientCount: recipientCount(input.input.to)
    },
    "Retrying email delivery after transient Resend error"
  );
}

function defaultSleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
