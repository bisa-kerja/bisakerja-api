---
title: Backend API Security Operations
description: Authentication, authorization, validation, upload, rate limit, CORS, dependency, secret, and sensitive logging rules for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/operations/security.md
last_reviewed: 2026-04-24
---

# Backend API Security Operations

This document defines the security expectations for the Bisakerja Backend API before implementation. It aligns with the platform trust boundary rule that the Backend API owns authentication, authorization, validation, workflow control, and frontend-safe response shaping.

Security-sensitive implementation choices must be documented before code is merged. If the selected auth/session strategy changes, this document, `docs/environment.md`, `docs/modules/auth.md`, and route tests must be updated together.

## Trust Boundary Summary

| Boundary                    | Backend API rule                                                                |
| --------------------------- | ------------------------------------------------------------------------------- |
| Browser to Frontend UI      | Treat all input as untrusted until server-side validation succeeds              |
| Frontend UI to Backend API  | Authenticate, authorize, validate, rate limit, and return stable API envelopes  |
| Backend API to PostgreSQL   | Access data only through documented repositories and ownership filters          |
| Backend API to Model API    | Send minimal prepared inference payloads and no frontend-originated credentials |
| Backend API to Scraper data | Read normalized job records; do not expose raw external source payloads         |

The Frontend UI must not call the Model API or Scraper API directly. The Model API must not decide whether an end user is authorized to act.

## Security Principles

- Default to deny for authenticated routes.
- Validate every request with Zod before business logic.
- Enforce user ownership in the backend, never only in the frontend.
- Store secrets, tokens, OTP values, and password reset values as hashes when persistence is needed.
- Return generic authentication errors that do not reveal account existence.
- Keep response errors safe for users and logs rich enough for debugging through request id correlation.
- Log security events without logging sensitive payloads.
- Pin dependency versions and review security advisories during setup and release.

## Authentication

The Auth module owns register, login, logout, refresh/session handling, email verification, forgot password, and reset password flows.

Required behavior:

- Normalize email before lookup and persistence.
- Hash passwords before storing credentials.
- Never store or log plaintext passwords.
- Do not reveal whether an email exists during login, forgot password, or reset password failures.
- Rate limit register, login, forgot password, reset password, and email verification routes more strictly than general routes.
- Require verified email before enabling sensitive account actions if the product decision requires verification.
- Audit register, login, logout, password reset request, password reset completion, and email verification events.

## Password Hashing

Use Argon2id through the `argon2` package.

Implementation requirements:

- Store only password hashes and hashing metadata needed for future upgrades.
- Start with memory cost `19456` KiB, time cost `2`, and parallelism `1`; tune upward only after measuring login latency and resource use.
- Reject weak passwords through documented validation rules.
- Add tests that confirm plaintext passwords are never returned, logged, or persisted.
- Define a rehash policy when hashing parameters change.

Minimum password validation direction:

| Rule      | Direction                                                                     |
| --------- | ----------------------------------------------------------------------------- |
| Length    | Enforce a documented minimum length                                           |
| Reuse     | Prevent immediate reuse during reset if password history is implemented later |
| Logging   | Redact all password fields from logs and error details                        |
| Transport | Require HTTPS in production through deployment configuration                  |

## Token Or Session Handling

The backend uses a hybrid web auth strategy: short-lived signed access JWTs plus opaque refresh tokens stored in `HttpOnly` cookies and persisted server-side as hashes.

| Area          | Required behavior                                                                             |
| ------------- | --------------------------------------------------------------------------------------------- |
| Access token  | Signed JWT with default `15m` TTL and minimal identity claims                                 |
| Refresh token | Opaque random credential in `HttpOnly` cookie; store only hash server-side                    |
| Rotation      | Refresh token rotation invalidates the previous token on every successful refresh             |
| Logout        | Logout invalidates the active refresh token or credential family                              |
| Expiry        | Expired tokens must fail with `401 UNAUTHENTICATED`                                           |
| Storage       | Frontend may keep access token in memory only; do not use `localStorage` for auth credentials |
| Cookies       | Configure `HttpOnly`, `Secure` in production, explicit `SameSite`, path, and `Max-Age`        |
| JWT           | Validate issuer, audience, expiry, signature, subject, and token type                         |

Cookie-backed refresh/logout endpoints must enforce configured origins. If deployment requires cross-site cookies, add CSRF token protection before production release.

Service-to-service credentials for Model API or Scraper API must be separate from end-user credentials and must never be accepted from the browser as proof of user identity.

## Authorization And Ownership

Authorization decisions live in the Backend API.

Required checks:

- User profile routes must load and update only the authenticated user's profile.
- Preference routes must load and update only the authenticated user's preference set.
- Bookmark routes must verify the authenticated user owns the bookmark.
- Application tracker routes must verify the authenticated user owns the application record.
- AI Job Fit routes must verify the user can access the selected job and that profile/preference context belongs to the current user.
- AI CV Analyzer routes must verify CV metadata, selected job, and any saved analysis belong to the current user.
- Admin or internal routes, if added later, require a separate role/permission document.

Ownership failures should return `404` when revealing resource existence would leak another user's data. Use `403` when the user is authenticated but explicitly lacks a known permission.

## Input Validation

All request bodies, route params, query params, and file metadata must be validated before service logic.

Required validation layers:

| Input                | Validation                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Body                 | Zod schema, unknown-field policy, field length limits                                      |
| Query                | Pagination bounds, enum validation, filter allowlist, sort allowlist                       |
| Params               | UUID or documented id format validation                                                    |
| Files                | MIME type, size, extension, content signature when feasible, count, and storage path rules |
| Downstream responses | Zod or equivalent schema validation before mapping to frontend responses                   |

Validation failures should return `422 VALIDATION_ERROR` when the request is syntactically valid but fields fail schema rules.

## CV Upload Security

CV uploads are sensitive user data.

Required controls:

- Accept only explicitly allowed MIME types from `CV_ALLOWED_MIME_TYPES`.
- Start with PDF-only upload support unless parser support for other formats is documented.
- Enforce `CV_UPLOAD_MAX_BYTES`.
- Reject empty files and multi-file uploads unless a route explicitly supports them.
- Store files outside public static paths.
- Generate server-side file names; never trust user-provided file names as storage paths.
- Strip or ignore path separators from original file names.
- Persist only metadata required for analysis, retention, or user value.
- Delete or expire uploaded CV files according to `CV_RETENTION_DAYS`, default `1` day for MVP temporary uploads.
- Never log raw CV content, extracted CV text, or full model input payloads.
- Consider malware scanning before production if uploads are retained beyond immediate analysis.

## Rate Limiting

Rate limits must be endpoint-aware.

| Endpoint group             | Risk                                      | Direction                                              |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| General reads              | Traffic spikes and scraping of public API | Moderate IP-based limits                               |
| Auth                       | Credential abuse                          | Strict IP-based and account-aware limits when feasible |
| Password reset and OTP     | Token abuse and inbox flooding            | Strict limits plus audit events                        |
| AI endpoints               | Cost, latency, and abuse                  | Strict per-user and per-IP limits                      |
| CV upload                  | Resource and privacy risk                 | Strict per-user and per-IP limits                      |
| Internal service endpoints | Unauthorized internal access              | Service token plus network restrictions                |

Rate limit failures should return `429 RATE_LIMITED` using the standard error envelope.

## CORS And Browser Security

Production CORS must allow only configured frontend origins.

Rules:

- Do not use wildcard origins in production.
- Keep `CORS_ORIGINS` environment-specific.
- If cookies are used, coordinate CORS credentials with cookie `SameSite` and `Secure` settings.
- Reject unexpected methods and headers unless explicitly needed.
- Keep internal service credentials out of browser-accessible responses.

Security headers should be enabled with Helmet or an equivalent package selected during setup. Any production exception must be documented before deployment.

## Sensitive Logging Rules

Logs must support debugging without leaking secrets or user-sensitive content.

Never log:

- Plaintext passwords.
- Password hashes.
- Access tokens, refresh tokens, session ids, OTP values, or reset tokens.
- Service credentials.
- Raw CV contents or extracted CV text.
- Full Model API payloads or raw Model API outputs when they include sensitive user context.
- Raw external source payloads from job platforms.
- Full database connection strings.

Allowed logging examples:

- Request id, route, method, status, latency, and user id hash or stable internal id when appropriate.
- Auth event type without credentials.
- Model API dependency status, timeout, and response classification.
- Upload file size and MIME type after validation, not file content.
- Job source freshness metadata.

## Audit Events

Audit events should be structured separately from ordinary request logs when possible.

Required audit event categories:

| Event                     | Required fields                                                    |
| ------------------------- | ------------------------------------------------------------------ |
| Register                  | request id, user id, email hash or normalized email policy, result |
| Login                     | request id, user id when known, result, failure reason category    |
| Logout                    | request id, user id, session or token record id when applicable    |
| Password reset request    | request id, result, target email hash or generic target id         |
| Password reset completion | request id, user id, result                                        |
| Email verification        | request id, user id, result                                        |
| Application status update | request id, user id, application id, old status, new status        |
| CV analysis request       | request id, user id, file metadata id, result                      |

Audit logs must not include secrets, raw CV content, or raw tokens.

## Database Security

Database access must follow the ownership and migration rules in `docs/database.md`.

Rules:

- Use least-privilege database credentials per environment.
- Keep migration credentials controlled separately if the hosting platform supports it.
- Do not expose Prisma errors directly to API consumers.
- Enforce unique constraints for account identity, bookmarks, application records, and source job identity.
- Keep token-like persisted values hashed.
- Use transactions for multi-record auth, tracker, and AI snapshot writes where consistency matters.

## Dependency Security

Project setup must pin exact dependency versions.

Required process:

- Select current compatible packages during setup instead of floating `latest` ranges.
- Review packages for Bun and TypeScript compatibility.
- Run `bun audit --json` or an equivalent security review in CI once package manager workflow is final.
- Document accepted high-risk dependency exceptions before release.
- Avoid abandoned packages for auth, upload parsing, validation, and rate limiting.
- Keep lockfile committed after package installation.

## Error Handling Security

Error responses must follow `docs/api-response-standard.md`.

Rules:

- Do not include stack traces in responses.
- Redact sensitive keys recursively from error details before returning them to clients.
- Do not expose raw downstream response bodies.
- Use `401 UNAUTHENTICATED` for missing, expired, or invalid credentials.
- Use `403 FORBIDDEN` for authenticated users without permission when existence is not sensitive.
- Use `404 NOT_FOUND` to hide user-owned resources that do not belong to the requester.
- Use `429 RATE_LIMITED` for rate limit failures.
- Use `502 DOWNSTREAM_ERROR` for invalid downstream responses.
- Use `503 SERVICE_UNAVAILABLE` for unavailable dependencies.

## Security Verification Checklist

Before implementing a security-sensitive feature, add tests for:

- Missing auth.
- Malformed auth header.
- Invalid auth.
- Expired token or session.
- Resource ownership negative case.
- Zod validation failure.
- Rate limit behavior where applicable.
- Redaction of sensitive values in logs and responses.
- Correct error envelope and request id.

Before release, confirm:

- Production CORS is not wildcard.
- Production cookie settings are secure if cookies are used.
- Refresh cookie output reflects configured `HttpOnly`, `Secure`, and `SameSite` flags.
- Secrets are environment-specific.
- Password hashing parameters are documented.
- Upload limits and retention are enforced.
- Dependency audit process has run.
- Auth and ownership route tests pass.

## Deferred Security Decisions

- Whether CV files become user-visible reusable documents after MVP.
- Whether malware scanning is required before first production release.
- Whether admin/internal operations exist in MVP.

## Related Docs

- `docs/architecture.md`
- `docs/environment.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/auth.md`
- `docs/modules/users.md`
- `docs/modules/applications.md`
- `docs/modules/ai-cv-analyzer.md`
- `references/docs/overview/authentication-and-trust-boundaries.mdx`
