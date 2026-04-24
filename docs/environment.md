---
title: Backend API Environment Configuration
description: Environment variable groups, local defaults, secret handling, and runtime separation for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/environment.md
last_reviewed: 2026-04-24
---

# Backend API Environment Configuration

This document defines the initial environment configuration model for the Bisakerja Backend API. The actual `.env.example` file should be created during project setup after package choices are pinned and the auth/session design is wired into code.

Environment variables must be validated at startup with Zod in `src/config/env.ts`. Missing required variables or invalid values should fail fast before the server accepts requests.

## Environment Groups

| Group         | Purpose                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| Application   | Runtime mode, port, API prefix, public base URL, and service identity    |
| Database      | PostgreSQL connection and Prisma behavior                                |
| Auth          | Token/session secrets, expiry, OTP, password reset, and cookie behavior  |
| Security      | CORS, rate limit, trusted proxy, and request limits                      |
| Integrations  | Model API, Scraper API, email provider, and external service credentials |
| Uploads       | CV upload limits, storage driver, storage path, and file retention       |
| Observability | Logging level, request id header, health checks, and error reporting     |

## Application Variables

| Variable       | Required | Local default           | Notes                                                                      |
| -------------- | -------- | ----------------------- | -------------------------------------------------------------------------- |
| `APP_NAME`     | No       | `bisakerja-api`         | Service name used in logs and health output                                |
| `APP_ENV`      | Yes      | `local`                 | Allowed values should include `local`, `test`, `staging`, and `production` |
| `NODE_ENV`     | Yes      | `development`           | Runtime ecosystem mode                                                     |
| `PORT`         | Yes      | `3000`                  | HTTP server port                                                           |
| `API_PREFIX`   | Yes      | `/api/v1`               | Default REST route prefix                                                  |
| `APP_URL`      | Yes      | `http://localhost:3000` | Backend base URL for callbacks or generated links                          |
| `FRONTEND_URL` | Yes      | `http://localhost:5173` | Primary frontend origin for local development                              |

## Database Variables

| Variable              | Required | Local default | Notes                                                                |
| --------------------- | -------- | ------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | None          | PostgreSQL connection string used by Prisma                          |
| `DIRECT_DATABASE_URL` | No       | None          | Optional direct database URL for migrations if pooling is introduced |
| `PRISMA_LOG_LEVEL`    | No       | `warn`        | Prisma logging level for development and debugging                   |
| `RUN_DATABASE_TESTS`  | No       | `false`       | Test-only flag that enables repository tests against PostgreSQL      |

Rules:

- Never commit real database credentials.
- Use a separate database for tests.
- Keep `RUN_DATABASE_TESTS=false` for ordinary local test runs unless the isolated test database is running and migrations are applied.
- Run migrations explicitly in deployment workflows; do not rely on application startup to mutate production schema unless that deployment policy is approved.

## Auth Variables

The backend uses short-lived access JWTs plus opaque refresh tokens stored in `HttpOnly` cookies and persisted server-side as hashes.

| Variable                     | Required | Local default        | Notes                                                     |
| ---------------------------- | -------- | -------------------- | --------------------------------------------------------- |
| `AUTH_ACCESS_TOKEN_SECRET`   | Yes      | None                 | Secret for access token signing if JWT is selected        |
| `AUTH_REFRESH_TOKEN_SECRET`  | Yes      | None                 | Secret used when deriving or signing refresh-token hashes |
| `AUTH_ACCESS_TOKEN_TTL`      | Yes      | `15m`                | Short-lived access token lifetime                         |
| `AUTH_REFRESH_TOKEN_TTL`     | Yes      | `7d`                 | Refresh token lifetime                                    |
| `PASSWORD_RESET_TOKEN_TTL`   | Yes      | `30m`                | Password reset token lifetime                             |
| `EMAIL_VERIFICATION_OTP_TTL` | Yes      | `10m`                | Email verification OTP lifetime                           |
| `AUTH_REFRESH_COOKIE_NAME`   | Yes      | `bisakerja_refresh`  | `HttpOnly` cookie name for refresh credential             |
| `AUTH_COOKIE_SECURE`         | Yes      | `false` locally      | Must be `true` in production                              |
| `AUTH_COOKIE_SAME_SITE`      | Yes      | `lax`                | Use `none` only with `Secure` and CSRF protection         |
| `AUTH_ISSUER`                | Yes      | `bisakerja-api`      | JWT issuer                                                |
| `AUTH_AUDIENCE`              | Yes      | `bisakerja-frontend` | JWT audience                                              |

Rules:

- Secrets must be long, random, and environment-specific.
- Refresh token rotation is mandatory.
- Access tokens are short-lived and should be stored by the frontend in memory only.
- Refresh tokens must not be returned in JSON responses or stored in browser `localStorage`.
- Password reset and OTP flows need stricter rate limits than ordinary authenticated routes.
- Email verification uses OTP for MVP; password reset uses a token link. Persist only hashed OTP/token values.

## Security Variables

| Variable                | Required | Local default           | Notes                                       |
| ----------------------- | -------- | ----------------------- | ------------------------------------------- |
| `CORS_ORIGINS`          | Yes      | `http://localhost:5173` | Comma-separated allowed frontend origins    |
| `TRUST_PROXY`           | No       | `false`                 | Enable only behind a trusted proxy          |
| `REQUEST_BODY_LIMIT`    | Yes      | `1mb`                   | JSON body limit                             |
| `RATE_LIMIT_WINDOW_MS`  | Yes      | `60000`                 | Default rate limit window                   |
| `RATE_LIMIT_MAX`        | Yes      | `120`                   | Default request count per window            |
| `AUTH_RATE_LIMIT_MAX`   | Yes      | `10`                    | Stricter limit for auth-sensitive endpoints |
| `UPLOAD_RATE_LIMIT_MAX` | Yes      | `10`                    | Stricter limit for CV upload endpoints      |
| `AI_RATE_LIMIT_MAX`     | Yes      | `20`                    | Stricter limit for AI inference endpoints   |

Rules:

- `CORS_ORIGINS` remains the explicit allowlist for external browser origins.
- The backend also treats the normalized origins derived from `APP_URL` and `FRONTEND_URL` as allowed automatically.
- This behavior keeps the built-in Scalar docs at `/docs/api` usable on the same backend origin without requiring a duplicate manual CORS entry.
- In local development, changing `APP_URL`, `FRONTEND_URL`, or `CORS_ORIGINS` requires restarting the backend process before browser tests are retried.

## Model API Variables

| Variable                  | Required                    | Local default           | Notes                                                             |
| ------------------------- | --------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `MODEL_API_BASE_URL`      | Yes for AI workflows        | `http://localhost:8000` | FastAPI inference service base URL                                |
| `MODEL_API_TIMEOUT_MS`    | Yes                         | `10000`                 | Request timeout for inference calls                               |
| `MODEL_API_SERVICE_TOKEN` | Yes outside local mock mode | None                    | Internal service credential if required                           |
| `MODEL_API_ENABLE_MOCK`   | No                          | `false`                 | Local-only fallback for development before Model API is available |

Rules:

- The frontend must never call Model API directly.
- Backend should send only the minimum profile, preference, job, and CV context needed for inference.
- Keep `MODEL_API_ENABLE_MOCK=true` only for local development and automated tests.
- When `MODEL_API_ENABLE_MOCK=false`, `MODEL_API_SERVICE_TOKEN` must be present at startup.
- Model API failures must map to documented 502 or 503 API responses.

## Scraper And Job Source Variables

| Variable                    | Required | Local default      | Notes                                                               |
| --------------------------- | -------- | ------------------ | ------------------------------------------------------------------- |
| `SCRAPER_API_BASE_URL`      | No       | None               | Required only if backend calls scraper status or internal endpoints |
| `SCRAPER_API_SERVICE_TOKEN` | No       | None               | Internal credential if backend-scraper HTTP calls are introduced    |
| `JOB_SOURCE_PRIORITY`       | No       | `glints,jobstreet` | Early implementation priority while domain supports four sources    |
| `JOB_STALE_AFTER_HOURS`     | Yes      | `72`               | Threshold used by docs and future operations to flag stale listings |

Rules:

- Supported source platforms are Glints, Jobstreet, Kalibrr, and Dealls.
- Backend API should consume normalized job records, not raw source payloads.
- Scraper-owned freshness and normalization behavior must be documented in integration docs before implementation.

## Upload Variables

| Variable                | Required             | Local default       | Notes                                                                     |
| ----------------------- | -------------------- | ------------------- | ------------------------------------------------------------------------- |
| `FILE_STORAGE_DRIVER`   | Yes                  | `local`             | Expected values can start with `local`; object storage can be added later |
| `UPLOAD_STORAGE_PATH`   | Yes for local driver | `./storage/uploads` | Local upload directory                                                    |
| `CV_UPLOAD_MAX_BYTES`   | Yes                  | `5242880`           | Default 5 MB CV limit                                                     |
| `CV_ALLOWED_MIME_TYPES` | Yes                  | `application/pdf`   | Start strict; expand only with documented parser support                  |
| `CV_RETENTION_DAYS`     | Yes                  | `1`                 | Temporary retention for uploaded CV files or metadata                     |

Rules:

- CV uploads are sensitive user data.
- MVP supports `UPLOAD` mode only. `REFERENCE` mode returns `422` until reusable CV storage is designed.
- Runtime config maps these variables into the validated `uploads` config group in `src/config/env.ts`.
- Store only what is needed for analysis, ownership, retention, and audit.
- Local uploads should live in a private directory outside static assets. The default local root is `./storage/uploads`.
- Clean expired files and metadata according to `CV_RETENTION_DAYS` with the manual command `bun run cleanup:cv-uploads` or an equivalent scheduled workflow.
- Do not persist raw extracted CV text or raw Model API payloads by default.

## Email Variables

| Variable             | Required                 | Local default                       | Notes                                                                      |
| -------------------- | ------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| `EMAIL_PROVIDER`     | Yes for auth email flows | `fake`                              | `fake` for local/tests, `resend` for real delivery                         |
| `EMAIL_FROM`         | Yes                      | `Bisakerja <no-reply@example.test>` | Sender address in `email@example.com` or `Name <email@example.com>` format |
| `RESEND_API_KEY`     | Yes for Resend           | None                                | Resend API key stored in secrets manager or env                            |
| `RESEND_MAX_RETRIES` | No                       | `2`                                 | Additional retry attempts for transient Resend failures                    |

Rules:

- Production must not use `EMAIL_PROVIDER=fake`.
- If `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` is required and `EMAIL_FROM` should use a verified Resend sending domain.
- Retry logic should rely on Resend idempotency keys and only retry transient failures such as rate limiting, temporary concurrency conflicts, or 5xx provider errors.
- Test defaults should keep `EMAIL_PROVIDER=fake` so auth flows remain deterministic and offline-safe.

## Observability Variables

| Variable                  | Required | Local default  | Notes                                |
| ------------------------- | -------- | -------------- | ------------------------------------ |
| `LOG_LEVEL`               | Yes      | `info`         | Structured logger level              |
| `REQUEST_ID_HEADER`       | No       | `x-request-id` | Header used to propagate request id  |
| `ENABLE_REQUEST_LOGGING`  | No       | `true`         | Log HTTP request summary             |
| `HEALTH_CHECK_TIMEOUT_MS` | Yes      | `2000`         | Timeout for dependency health checks |
| `ERROR_REPORTING_DSN`     | No       | None           | Optional error reporting integration |

Rules:

- Logs must not include passwords, tokens, OTP values, raw CV content, or full sensitive payloads.
- Every error response should include or correlate with a request id.
- Dependency health should distinguish database, model service, and scraper-related issues.

## Environment Separation

| Environment  | Purpose                   | Data rule                                                                    |
| ------------ | ------------------------- | ---------------------------------------------------------------------------- |
| `local`      | Developer machine         | Local or disposable data only                                                |
| `test`       | Automated tests           | Isolated database and deterministic fixtures                                 |
| `staging`    | Pre-production validation | Production-like config with non-production secrets                           |
| `production` | User-facing runtime       | Managed secrets, strict CORS, secure cookies if used, and real observability |

## `.env.example` Requirements

When the project scaffold is created, `.env.example` must:

- Include every required variable with safe placeholder values.
- Exclude real secrets.
- Group variables using the sections in this document.
- Mark variables that are only required when a feature is enabled.
- Stay in sync with `src/config/env.ts`.

## `.env.test.example` Requirements

The test environment example must use `APP_ENV=test` and `NODE_ENV=test`. Database values must point to an isolated test database, not local development, staging, or production data. Integration test helpers should fail fast when the runtime environment is not `test` or when a provided database URL does not clearly identify a local or test-only database.

Test defaults should use fake providers or local mocks for email, Model API, Scraper API, and uploads. Test logs should default to `silent` unless a failing test needs diagnostic output.

Repository integration tests should keep `RUN_DATABASE_TESTS=false` for ordinary full-suite runs. Set `RUN_DATABASE_TESTS=true` only when running against an isolated PostgreSQL test database with committed migrations applied. Migration verification commands may set this flag automatically after applying migrations.

## Related Docs

- `docs/overview.md`
- `docs/tech-stack.md`
- `docs/integrations/resend.md`
- `references/docs/overview/authentication-and-trust-boundaries.mdx`
- `references/docs/operations/environments.mdx`
