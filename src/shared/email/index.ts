import type { AppConfig } from "@/config/env";
import { FakeEmailService } from "@/shared/email/email.fake";
import { ResendEmailService } from "@/shared/email/email.resend";

export { FakeEmailService } from "@/shared/email/email.fake";
export { ResendEmailService } from "@/shared/email/email.resend";
export type {
  EmailProviderName,
  EmailService,
  EmailTag,
  ResendClient,
  SendEmailInput,
  SendEmailResult
} from "@/shared/email/email.types";

export function createEmailService(config: AppConfig) {
  if (config.email.provider === "resend") {
    return new ResendEmailService(config);
  }

  return new FakeEmailService();
}
