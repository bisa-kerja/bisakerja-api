---
title: Resend Integration
description: Resend transactional email integration for auth and future backend modules, including configuration, retry behavior, and usage examples.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/integrations/resend.md
last_reviewed: 2026-04-24
---

# Resend Integration

Bisakerja uses Resend as the transactional email provider for production-ready email delivery. The integration is wrapped behind a shared service layer so modules do not depend directly on the Resend SDK.

## Runtime Configuration

Required environment variables for real delivery:

- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM="Bisakerja <no-reply@your-verified-domain.tld>"`
- `RESEND_API_KEY=re_...`

Optional runtime control:

- `RESEND_MAX_RETRIES=2`

Rules:

- Keep `RESEND_API_KEY` in environment variables or a secrets manager. Do not hardcode it in source code, tests, or documentation examples.
- `EMAIL_FROM` must match a verified sending domain in Resend for non-test recipients.
- Local and automated tests should normally keep `EMAIL_PROVIDER=fake`.

## Service Structure

Shared email delivery lives in `src/shared/email/**`.

Main entry points:

- `createEmailService(config)` creates either the fake provider or `ResendEmailService`.
- `EmailService.send()` is the provider-agnostic contract for modules.
- `AuthEmailProvider` in `src/modules/auth/auth.email.ts` adapts auth-specific templates on top of the shared service.

This keeps SDK-specific concerns such as idempotency keys, retry decisions, and provider error mapping out of business modules.

## Retry and Error Handling

The Resend implementation uses SDK-level idempotency keys for each email send. This allows the backend to retry transient failures without sending duplicate emails.

Current retry policy:

- Retry transient Resend failures such as `rate_limit_exceeded`, `concurrent_idempotent_requests`, and provider `5xx` responses.
- Honor the `retry-after` response header when Resend returns it.
- Map exhausted transient failures to `EMAIL_DELIVERY_UNAVAILABLE`.
- Map non-retryable provider failures such as invalid API keys or invalid sender configuration to `EMAIL_DELIVERY_FAILED`.

The implementation follows Resend guidance to use idempotency keys for safe retries and to respect rate limiting headers when reducing request pressure.

## Usage Example

Example for a future module that needs direct email delivery through the shared abstraction:

```ts
import { env } from "@/config/env";
import { createEmailService } from "@/shared/email";

const emailService = createEmailService(env);

await emailService.send({
  to: "user@example.com",
  subject: "Welcome to Bisakerja",
  html: "<p>Your account is ready.</p>",
  text: "Your account is ready.",
  tags: [{ name: "category", value: "welcome" }],
  idempotencyKey: "welcome-user/12345"
});
```

The Auth module already uses this shared service through `AuthEmailProvider`, so registration, email verification, and forgot-password flows do not instantiate the Resend SDK directly.
