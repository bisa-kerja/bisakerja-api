import { logger } from "@/config/logger";
import type {
  EmailService,
  SendEmailInput,
  SendEmailResult
} from "@/shared/email/email.types";

export class FakeEmailService implements EmailService {
  send(input: SendEmailInput): Promise<SendEmailResult> {
    logger.info(
      {
        provider: "fake",
        to: normalizeRecipients(input.to),
        subject: input.subject,
        idempotencyKey: input.idempotencyKey ?? null
      },
      "Email queued via fake provider"
    );

    return Promise.resolve({
      provider: "fake",
      messageId: null,
      acceptedAt: new Date(),
      idempotencyKey: input.idempotencyKey ?? null
    });
  }
}

function normalizeRecipients(value: string | string[]) {
  return Array.isArray(value) ? value : [value];
}
