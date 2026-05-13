import type { CreateEmailOptions, CreateEmailRequestOptions } from "resend";

export type EmailProviderName = "fake" | "resend";

export type EmailTag = {
  name: string;
  value: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  tags?: EmailTag[];
  idempotencyKey?: string;
};

export type SendEmailResult = {
  provider: EmailProviderName;
  messageId: string | null;
  acceptedAt: Date;
  idempotencyKey: string | null;
};

export type EmailService = {
  send(input: SendEmailInput): Promise<SendEmailResult>;
};

export type ResendClient = {
  emails: {
    send(
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions
    ): Promise<{
      data: { id: string } | null;
      error: {
        message: string;
        name: string;
        statusCode: number | null;
      } | null;
      headers: Record<string, string> | null;
    }>;
  };
};
