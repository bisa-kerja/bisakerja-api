---
title: Backend API Environment Configuration
description: Environment variable groups, explicit env requirements, secret handling, and runtime separation for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/environment.md
last_reviewed: 2026-04-29
---

# Backend API Environment Configuration

This document defines the environment configuration model for the Bisakerja Backend API.

Environment variables must be validated at startup with Zod in `src/config/env.ts`. Missing required variables or invalid values should fail fast before the server accepts requests.

Environment rules are intentionally strict:

- Do not rely on runtime defaults or fallback values for application configuration env vars.
- Do not represent "not configured" as an empty string.
- If an env var is required by the schema, every environment file must set it explicitly with either a real secret or a safe non-empty placeholder.

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

| Variable       | Required | Example value           | Notes                                                                      |
| -------------- | -------- | ----------------------- | -------------------------------------------------------------------------- |
| `APP_NAME`     | Yes      | `bisakerja-api`         | Service name used in logs and health output                                |
| `APP_ENV`      | Yes      | `local`                 | Allowed values should include `local`, `test`, `staging`, and `production` |
| `NODE_ENV`     | Yes      | `development`           | Runtime ecosystem mode                                                     |
| `PORT`         | Yes      | `3000`                  | HTTP server port inside the runtime container or local process             |
| `API_PREFIX`   | Yes      | `/api/v1`               | Default REST route prefix                                                  |
| `APP_URL`      | Yes      | `http://localhost:3000` | Backend base URL for callbacks or generated links                          |
| `FRONTEND_URL` | Yes      | `http://localhost:5173` | Primary frontend origin for local development                              |

## Database Variables

| Variable              | Required | Example value  | Notes                                                                              |
| --------------------- | -------- | -------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | provider URL   | PostgreSQL connection string used by runtime app and Prisma runtime adapter        |
| `DIRECT_DATABASE_URL` | Yes      | provider URL   | PostgreSQL direct connection used by Prisma CLI, migrations, and seed flows        |
| `PRISMA_LOG_LEVEL`    | Yes      | `warn`         | Prisma logging level for development and debugging                                 |
| `SEED_USER_PASSWORD`  | Yes      | `Password123!` | Seed-only login password for deterministic local/test accounts                     |
| `RUN_DATABASE_TESTS`  | Yes      | `false`        | Test-only flag that enables repository tests against PostgreSQL when set to `true` |

Rules:

- Never commit real database credentials.
- Use a separate database for tests.
- For Neon, Supabase, or similar managed PostgreSQL, set `DATABASE_URL` to the pooled connection string and `DIRECT_DATABASE_URL` to the non-pooled direct host.
- The repository no longer falls back from `DIRECT_DATABASE_URL` to `DATABASE_URL` inside Prisma CLI or seed scripts. Both values must be present explicitly.
- `SEED_USER_PASSWORD` is mandatory for seed runs so misconfigured local/test credentials fail immediately instead of silently reusing a hidden default.
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

| Variable                  | Required | Example value                | Notes                                                           |
| ------------------------- | -------- | ---------------------------- | --------------------------------------------------------------- |
| `MODEL_API_BASE_URL`      | Yes      | `http://localhost:8000`      | FastAPI inference service base URL                              |
| `MODEL_API_TIMEOUT_MS`    | Yes      | `10000`                      | Request timeout for inference calls                             |
| `MODEL_API_SERVICE_TOKEN` | Yes      | `your-local-model-api-token` | Internal service credential; use non-empty placeholder in mocks |
| `MODEL_API_ENABLE_MOCK`   | Yes      | `true`                       | Local/test toggle for mocked AI responses                       |

Rules:

- The frontend must never call Model API directly.
- Backend should send only the minimum profile, preference, job, and CV context needed for inference.
- Keep `MODEL_API_ENABLE_MOCK=true` only for local development and automated tests.
- `MODEL_API_SERVICE_TOKEN` is always required by env validation even when mock mode is enabled; local/test env files should use a safe non-empty placeholder.
- Model API failures must map to documented 502 or 503 API responses.

## Job Catalog Freshness Variables

| Variable                | Required | Local default | Notes                                                       |
| ----------------------- | -------- | ------------- | ----------------------------------------------------------- |
| `JOB_STALE_AFTER_HOURS` | Yes      | `72`          | Threshold used by the backend to flag stale normalized jobs |

Rules:

- Supported source platforms are Glints, Jobstreet, Kalibrr, and Dealls in repository docs and seed data.
- Backend API should consume normalized job records, not raw source payloads.
- Scraper-owned freshness and normalization behavior stay documented in integration docs, but the current runtime does not expose scraper-specific connection env vars.

## Upload Variables

| Variable                | Required             | Local default       | Notes                                                    |
| ----------------------- | -------------------- | ------------------- | -------------------------------------------------------- |
| `FILE_STORAGE_DRIVER`   | Yes                  | `local`             | Current runtime supports only `local`                    |
| `UPLOAD_STORAGE_PATH`   | Yes for local driver | `./storage/uploads` | Local upload directory                                   |
| `CV_UPLOAD_MAX_BYTES`   | Yes                  | `5242880`           | Default 5 MB CV limit                                    |
| `CV_ALLOWED_MIME_TYPES` | Yes                  | `application/pdf`   | Start strict; expand only with documented parser support |
| `CV_RETENTION_DAYS`     | Yes                  | `1`                 | Temporary retention for uploaded CV files or metadata    |

Rules:

- CV uploads are sensitive user data.
- MVP supports `UPLOAD` mode only. `REFERENCE` mode returns `422` until reusable CV storage is designed.
- Runtime config maps these variables into the validated `uploads` config group in `src/config/env.ts`.
- Store only what is needed for analysis, ownership, retention, and audit.
- Local uploads should live in a private directory outside static assets. The default local root is `./storage/uploads`.
- Clean expired files and metadata according to `CV_RETENTION_DAYS` with the manual command `bun run cleanup:cv-uploads` or an equivalent scheduled workflow.
- Do not persist raw extracted CV text or raw Model API payloads by default.

## Email Variables

| Variable             | Required                 | Example value                       | Notes                                                                      |
| -------------------- | ------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| `EMAIL_PROVIDER`     | Yes for auth email flows | `fake`                              | `fake` for local/tests, `resend` for real delivery                         |
| `EMAIL_FROM`         | Yes                      | `Bisakerja <no-reply@example.test>` | Sender address in `email@example.com` or `Name <email@example.com>` format |
| `RESEND_API_KEY`     | Yes                      | `your-local-resend-api-key`         | Real key for resend mode; non-empty placeholder for fake mode              |
| `RESEND_MAX_RETRIES` | Yes                      | `2`                                 | Additional retry attempts for transient Resend failures                    |

Rules:

- Production must not use `EMAIL_PROVIDER=fake`.
- If `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` must be a real provider key and `EMAIL_FROM` should use a verified Resend sending domain.
- Even when `EMAIL_PROVIDER=fake`, `RESEND_API_KEY` should stay present as a non-empty placeholder so config drift is visible immediately.
- Retry logic should rely on Resend idempotency keys and only retry transient failures such as rate limiting, temporary concurrency conflicts, or 5xx provider errors.
- Test defaults should keep `EMAIL_PROVIDER=fake` so auth flows remain deterministic and offline-safe.

## Observability Variables

| Variable                  | Required | Local default  | Notes                                |
| ------------------------- | -------- | -------------- | ------------------------------------ |
| `LOG_LEVEL`               | Yes      | `info`         | Structured logger level              |
| `REQUEST_ID_HEADER`       | Yes      | `x-request-id` | Header used to propagate request id  |
| `ENABLE_REQUEST_LOGGING`  | Yes      | `true`         | Log HTTP request summary             |
| `HEALTH_CHECK_TIMEOUT_MS` | Yes      | `2000`         | Timeout for dependency health checks |

Rules:

- Logs must not include passwords, tokens, OTP values, raw CV content, or full sensitive payloads.
- Every error response should include or correlate with a request id.
- Current runtime readiness checks PostgreSQL explicitly. Model API failures and job-data freshness issues are surfaced through route-level errors, logs, and module-specific handling rather than a separate global health env contract.

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
- Prefer safe non-empty placeholders over blank strings so validation behavior matches real runtime rules.
- Stay in sync with `src/config/env.ts`.

## Deployment Env File Example

The repository provides one deployment-oriented example for Compose-based VPS rollout:

| File                      | Intended use                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| `.env.production.example` | Baseline for `docker-compose.yml` and the single VPS deployment workflow |

Rules:

- This file is an operator-facing template, not a committed secret.
- The deployment workflow writes its secret payload to `.env.production`.
- `APP_ENV` in that file must match the target runtime environment, because the remote deploy script rejects mismatches when an explicit expectation is configured.
- The current staging rollout expects `APP_ENV=staging` with `NODE_ENV=production`.
- Compose-specific variables such as `APP_BIND_ADDRESS` and `APP_PORT` should stay documented in this template.
- The deployment template no longer bootstraps a PostgreSQL container; `DATABASE_URL` and `DIRECT_DATABASE_URL` must point to the managed database instance directly.
- The current rollout still targets staging first, but it intentionally uses the same production-style env file that will later be reused when the deployment branch changes to `main`.

## `.env.test.example` Requirements

The test environment example must use `APP_ENV=test` and `NODE_ENV=test`. Database values must point to an isolated test database, not local development, staging, or production data. That isolated database may live on localhost or on a managed PostgreSQL provider, but the URL should clearly identify test-only scope such as a dedicated test database name. Integration test helpers should fail fast when the runtime environment is not `test` or when a provided database URL does not clearly identify a local or test-only database.

Test defaults should use fake providers or local mocks for email and Model API, plus an isolated local upload path. Test logs should default to `silent` unless a failing test needs diagnostic output. Even in fake/mock mode, env values should stay explicit and non-empty.

Repository integration tests should keep `RUN_DATABASE_TESTS=false` for ordinary full-suite runs. Set `RUN_DATABASE_TESTS=true` only when running against an isolated PostgreSQL test database with committed migrations applied. Migration verification commands may set this flag automatically after applying migrations.

## Documentation Discipline

- Every feature, bug fix, behavior change, env contract change, migration rule change, or operational change must update the relevant files under `docs/**` and repo-level docs such as `README.md` when applicable.
- If a change introduces or modifies an environment variable, update `.env.example`, `.env.test.example`, `.env.production.example`, and this document in the same work item.
- If a change affects deployment, testing, database behavior, or generated docs workflow, update the corresponding operations doc in the same work item.

## Related Docs

- `docs/overview.md`
- `docs/tech-stack.md`
- `docs/integrations/resend.md`
- `references/docs/overview/authentication-and-trust-boundaries.mdx`
- `references/docs/operations/environments.mdx`
