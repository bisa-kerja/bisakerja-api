---
title: Backend API Reference
description: Route group index, API versioning, auth classification, common query patterns, and module contract checklist for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/api-reference.md
last_reviewed: 2026-04-24
---

# Backend API Reference

This document is the route group index for the Bisakerja Backend API. It defines API versioning, route prefix, auth behavior, common query patterns, and the contract checklist that module-specific API docs must follow.

Detailed endpoint request and response schemas are documented in module pages as implementation matures.

Generated route inventory lives in `docs/generated/routes.md`. It is derived from the runtime route registry and should be used as the fastest drift check against this reference page when new endpoints are added or removed.

Machine-readable OpenAPI output now lives in `docs/generated/openapi.json`. The runtime also publishes the same document at `/openapi.json`, and the built-in interactive API reference is available through Scalar at `/docs/api`.

## OpenAPI And Scalar

The backend now exposes one canonical OpenAPI document, one runtime interactive viewer, and one repository-level Scalar Docs config:

| Surface                  | Path                          | Purpose                                                                    |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------------- |
| Generated artifact       | `docs/generated/openapi.json` | Committed machine-readable contract used for review, sync, and tooling     |
| Runtime OpenAPI endpoint | `/openapi.json`               | Same contract served directly by the running backend                       |
| Runtime Scalar reference | `/docs/api`                   | Interactive API documentation rendered by Scalar with default config       |
| Scalar Docs config       | `scalar.config.json`          | Repository-level config for previewing or publishing docs with Scalar Docs |

Scalar is intentionally configured with the simplest setup that matches the official documentation pattern: it only points to the local OpenAPI URL and does not require additional theme or proxy customization for the current same-origin backend setup.

Because the backend uses strict Helmet security headers, the docs page also sends a route-specific CSP that permits the Scalar script source and a per-request nonce for the inline initializer without weakening the application's global CSP policy.

The interactive API client in Scalar sends browser requests, so CORS rules still apply. The backend automatically allows the normalized origins from `APP_URL` and `FRONTEND_URL` in addition to `CORS_ORIGINS`, which keeps same-origin testing from `/docs/api` working without extra local CORS duplication.

Recommended local workflow:

1. Start the backend.
2. Open `http://localhost:3000/docs/api`.
3. Use `http://localhost:3000/openapi.json` when another tool needs the raw OpenAPI contract.

For repository-based Scalar Docs preview, use the committed [scalar.config.json](/Users/macbookpro/Development/bisakerja-api/scalar.config.json:1). It maps the existing `docs/**` pages plus `docs/generated/openapi.json` into a Scalar Docs navigation tree, so the same content can be previewed or published without reorganizing the repository.

Available Scalar Docs commands from `package.json`:

- `bun run docs:scalar:check-config`
- `bun run docs:scalar:preview`

When routes or request and response contracts change:

1. Update the relevant module implementation and module docs.
2. Regenerate the committed OpenAPI artifact with `bun run docs:generate:openapi`.
3. Regenerate route inventory and sync-readiness docs with `bun run docs:generate:routes` and `bun run docs:generate:sync-readiness` when the route surface or sync metadata changes.
4. Run `bun run docs:check` and `bun run docs:scalar:check-config` before merging.

## Documentation Map

Use the documentation set in this order when onboarding or reviewing API changes:

| File                                    | Use it for                                                                |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `docs/api-reference.md`                 | Main API index, route grouping, auth model, shared query and header rules |
| `docs/generated/openapi.json`           | Canonical machine-readable contract for Scalar and external tooling       |
| `docs/generated/routes.md`              | Fast runtime drift check against mounted routes                           |
| `scalar.config.json`                    | Scalar Docs site map that wires repo pages and OpenAPI into one docs site |
| `docs/modules/*.md`                     | Per-module endpoint behavior, request and response examples, and errors   |
| `docs/api-response-standard.md`         | Shared success and error envelope rules                                   |
| `docs/operations/testing.md`            | Test commands, folder structure, helpers, and how to add new tests        |
| `docs/operations/documentation-sync.md` | How generated and hand-authored docs are kept in sync                     |

## Base URL And Versioning

Default local base URL:

```text
http://localhost:3000/api/v1
```

Rules:

- All product API routes are mounted under `API_PREFIX`, defaulting to `/api/v1`.
- Version `v1` is the first MVP contract.
- Breaking changes require a new version or an explicit migration plan.
- Non-breaking additions may be added to `v1` when they do not change existing field meaning or error behavior.
- Health endpoints may live outside `/api/v1` if operational tooling requires it.

## API Consumers

| Consumer                 | Access                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Frontend UI              | Public and authenticated `/api/v1` routes                                                       |
| Backend internal clients | Internal routes only when explicitly documented                                                 |
| Model API                | Does not call user-facing Backend API routes in MVP                                             |
| Scraper API              | Does not call user-facing Backend API routes in MVP unless future sync/status workflow is added |

The frontend must not call Scraper API or Model API directly.

## Auth Classification

| Class               | Meaning                                         | Example                                                    |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Public              | No authentication required                      | Job search, job detail, register, login                    |
| Authenticated       | Valid user identity required                    | Profile, preferences, bookmarks, applications, AI features |
| Ownership-protected | Authenticated and resource must belong to user  | User application record, saved jobs, AI result history     |
| Internal            | Service credential or internal network required | Future scraper status or admin service hooks               |

Rules:

- Authenticated and ownership-protected routes must enforce authorization in Backend API.
- Model API must not decide whether the user can perform a product action.
- Internal service credentials must not be derived from frontend-originated identity.
- Use `401` for missing or invalid authentication.
- Use `403` for authenticated users who are not allowed to act.
- Use `404` when hiding private resource existence is safer.

## Route Group Index

| Route group    | Prefix                          | Auth class                                                           | MVP scope                                                                                            | Future module doc                  |
| -------------- | ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Health         | `/health/live`, `/health/ready` | Public or infrastructure-restricted                                  | Liveness and readiness                                                                               | `docs/modules/health.md` if needed |
| Auth           | `/api/v1/auth`                  | Public plus authenticated logout/session routes                      | Register, login, logout, refresh/session, password reset, email verification, Google SSO placeholder | `docs/modules/auth.md`             |
| Users          | `/api/v1/me`                    | Authenticated                                                        | Current user profile and account settings                                                            | `docs/modules/users.md`            |
| Preferences    | `/api/v1/me/preferences`        | Authenticated                                                        | Career preferences and notification toggle                                                           | `docs/modules/preferences.md`      |
| Jobs           | `/api/v1/jobs`                  | Public for search/detail; authenticated for personalized views later | Search, filter, sort, list, detail                                                                   | `docs/modules/jobs.md`             |
| Bookmarks      | `/api/v1/me/bookmarks`          | Authenticated and ownership-protected                                | Save, unsave, list saved jobs                                                                        | `docs/modules/bookmarks.md`        |
| Applications   | `/api/v1/me/applications`       | Authenticated and ownership-protected                                | Application tracker records and status updates                                                       | `docs/modules/applications.md`     |
| AI Job Fit     | `/api/v1/ai/job-fit`            | Authenticated                                                        | Fit score, explanation, skill gap, and recommendation                                                | `docs/modules/ai-job-fit.md`       |
| AI CV Analyzer | `/api/v1/ai/cv-analyzer`        | Authenticated                                                        | CV analysis against selected job                                                                     | `docs/modules/ai-cv-analyzer.md`   |

Route naming defaults:

- Use `/api/v1/me/*` for current-user scoped resources.
- Use plural resource nouns for collections.
- Use action names only when the endpoint performs a non-CRUD workflow, such as AI analysis.
- Keep route params camelCase in docs, such as `:jobId` and `:applicationId`.

## Public Workflows

Public workflows:

- Register.
- Login.
- Forgot password request.
- Reset password submission when token or OTP is valid.
- Email verification submission when token or OTP is valid.
- Job search.
- Job detail.
- Health liveness check.
- Health readiness check for infrastructure and deployment tooling.

Public routes still require validation, rate limiting, and safe error responses.

## Health Endpoints

Health endpoints are mounted outside `API_PREFIX` so infrastructure tooling can check runtime status without depending on versioned product routes.

| Method | Path            | Auth | Purpose                                        |
| ------ | --------------- | ---- | ---------------------------------------------- |
| `GET`  | `/health/live`  | None | Confirms the process can respond to HTTP       |
| `GET`  | `/health/ready` | None | Confirms the runtime is ready to serve traffic |

`GET /health/live` does not check PostgreSQL or downstream services.

`GET /health/ready` checks PostgreSQL and returns `503 SERVICE_UNAVAILABLE` when the database is unavailable or the check times out. Dependency details in public responses are limited to sanitized health state.

Successful readiness response:

```json
{
  "success": true,
  "message": "Service is ready",
  "data": {
    "service": "bisakerja-api",
    "status": "ready",
    "env": "staging",
    "dependencies": {
      "postgresql": "healthy"
    }
  },
  "meta": null
}
```

Readiness failure response:

```json
{
  "success": false,
  "message": "Service is not ready",
  "data": null,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "details": {
      "dependencies": {
        "postgresql": "unhealthy"
      }
    },
    "requestId": "req_123"
  }
}
```

## Authenticated Workflows

Authenticated workflows:

- Current user profile read and update.
- Onboarding data update.
- Career preferences read and update.
- Bookmark create, delete, and list.
- Application tracker create, update, status change, and list.
- Job fit analysis.
- Skill gap analysis.
- AI CV Analyzer.
- Viewing user-specific AI history if persisted.

Authenticated routes must not rely on frontend-only ownership checks.

## Internal Workflows

Internal workflows are not part of the public MVP API unless explicitly documented later.

Potential future internal workflows:

- Scraper freshness status.
- Ingestion sync callbacks.
- Admin-only data correction.
- Model health or model version reconciliation.

Internal routes must define service credential requirements before implementation.

## Common Query Parameters

### Pagination

| Query   | Type   | Default | Applies to     |
| ------- | ------ | ------- | -------------- |
| `page`  | number | `1`     | List endpoints |
| `limit` | number | `20`    | List endpoints |

Constraints:

- `page` minimum is `1`.
- `limit` minimum is `1`.
- `limit` maximum is `100`.
- Invalid values return `422` with `VALIDATION_ERROR`.

### Job Search And Filters

| Query             | Type   | Description                                                               |
| ----------------- | ------ | ------------------------------------------------------------------------- |
| `keyword`         | string | Search by job title, role, company, or relevant normalized text           |
| `location`        | string | General location search when province/city are not split                  |
| `province`        | string | Province filter when normalized                                           |
| `city`            | string | City filter when normalized                                               |
| `workType`        | enum   | `REMOTE`, `HYBRID`, or `ONSITE`                                           |
| `employmentType`  | enum   | Full-time, part-time, internship, contract, or documented enum equivalent |
| `experienceLevel` | enum   | Entry, junior, mid, or documented enum equivalent                         |
| `salaryMin`       | number | Minimum expected salary                                                   |
| `salaryMax`       | number | Maximum expected salary                                                   |
| `sourcePlatform`  | string | Glints, Jobstreet, Kalibrr, Dealls, or normalized source slug             |
| `skill`           | string | Normalized skill or requirement keyword                                   |
| `category`        | string | Normalized job category when available                                    |

Rules:

- Job search works for guests and authenticated users.
- The backend returns normalized job records only.
- Source-specific raw payloads must not appear in responses.
- Unsupported filters return `422`.

### Sorting

| Query  | Default     | Applies to                                   |
| ------ | ----------- | -------------------------------------------- |
| `sort` | `relevance` | Jobs and other list endpoints when supported |

Supported job sort values:

- `relevance`
- `newest`
- `salary_highest`
- `salary_lowest`

Other list sort values:

- `updated_desc`
- `created_desc`

Unsupported sort values return `422`.

Job search falls back to newest-first ordering when `sort=relevance` is requested without a keyword, and the response metadata reports the actual sort as `newest`.

## Common Headers

| Header          | Direction             | Required             | Notes                                                  |
| --------------- | --------------------- | -------------------- | ------------------------------------------------------ |
| `Authorization` | Request               | Authenticated routes | Use `Bearer <accessToken>` for authenticated API calls |
| `Content-Type`  | Request               | Body routes          | Use `application/json` except upload routes            |
| `Accept`        | Request               | Recommended          | Use `application/json`                                 |
| `x-request-id`  | Request/response logs | Optional             | Backend accepts or generates request id                |
| `Cookie`        | Request               | Refresh/logout flows | Refresh credential is sent as an `HttpOnly` cookie     |
| `Set-Cookie`    | Response              | Login/refresh/logout | Backend sets or clears the refresh cookie              |

Upload routes for AI CV Analyzer will require multipart handling details in the module doc.

## Standard Response Usage

All route groups must follow `docs/api-response-standard.md`.

Module docs must include:

- Success response example.
- List response example when the endpoint returns a collection.
- Validation error example.
- Auth error example for authenticated routes.
- Not found example for owned resources.
- Conflict example for duplicate or invalid state transition.
- Downstream failure example for AI routes.

## Module Contract Checklist

Every module API doc must include:

- Route prefix.
- Endpoint table with method and path.
- Auth class per endpoint.
- Request params schema.
- Request query schema.
- Request body schema.
- Response schema.
- Error cases.
- Pagination, filtering, and sorting behavior when applicable.
- Ownership rules.
- Database models read or written.
- Downstream dependencies.
- Observability notes.
- Test scenarios.

## Endpoint Planning Matrix

The endpoint list below is a planning index, not final endpoint documentation.

### Auth

| Method | Path                           | Auth                     | Purpose                                         |
| ------ | ------------------------------ | ------------------------ | ----------------------------------------------- |
| `POST` | `/api/v1/auth/register`        | Public                   | Create account                                  |
| `POST` | `/api/v1/auth/login`           | Public                   | Issue access token and refresh cookie           |
| `POST` | `/api/v1/auth/logout`          | Authenticated            | Invalidate refresh token and clear cookie       |
| `POST` | `/api/v1/auth/refresh`         | Refresh cookie           | Rotate refresh token and issue new access token |
| `POST` | `/api/v1/auth/forgot-password` | Public                   | Request password reset                          |
| `POST` | `/api/v1/auth/reset-password`  | Public with token or OTP | Complete password reset                         |
| `POST` | `/api/v1/auth/verify-email`    | Public with token or OTP | Verify email                                    |

### Users And Preferences

| Method  | Path                       | Auth          | Purpose                              |
| ------- | -------------------------- | ------------- | ------------------------------------ |
| `GET`   | `/api/v1/me`               | Authenticated | Get current user profile             |
| `PATCH` | `/api/v1/me`               | Authenticated | Update current user profile          |
| `PUT`   | `/api/v1/me/profile-photo` | Authenticated | Upsert profile photo metadata        |
| `PUT`   | `/api/v1/me/skills`        | Authenticated | Replace user skill list              |
| `PUT`   | `/api/v1/me/experience`    | Authenticated | Replace user experience list         |
| `PUT`   | `/api/v1/me/education`     | Authenticated | Replace user education list          |
| `GET`   | `/api/v1/me/preferences`   | Authenticated | Get career preferences               |
| `PUT`   | `/api/v1/me/preferences`   | Authenticated | Replace or upsert career preferences |
| `PATCH` | `/api/v1/me/preferences`   | Authenticated | Partially update career preferences  |

### Jobs

| Method | Path                  | Auth   | Purpose                           |
| ------ | --------------------- | ------ | --------------------------------- |
| `GET`  | `/api/v1/jobs`        | Public | Search and filter normalized jobs |
| `GET`  | `/api/v1/jobs/:jobId` | Public | Get normalized job detail         |

### Bookmarks

| Method   | Path                          | Auth          | Purpose          |
| -------- | ----------------------------- | ------------- | ---------------- |
| `GET`    | `/api/v1/me/bookmarks`        | Authenticated | List saved jobs  |
| `POST`   | `/api/v1/me/bookmarks`        | Authenticated | Save a job       |
| `DELETE` | `/api/v1/me/bookmarks/:jobId` | Authenticated | Remove saved job |

### Applications

| Method  | Path                                            | Auth                                  | Purpose                   |
| ------- | ----------------------------------------------- | ------------------------------------- | ------------------------- |
| `GET`   | `/api/v1/me/applications`                       | Authenticated                         | List tracked applications |
| `POST`  | `/api/v1/me/applications`                       | Authenticated                         | Create tracker record     |
| `PATCH` | `/api/v1/me/applications/:applicationId`        | Authenticated and ownership-protected | Update tracker record     |
| `PATCH` | `/api/v1/me/applications/:applicationId/status` | Authenticated and ownership-protected | Update application status |

Application tracker endpoints use the standard response envelope. List responses include pagination, supplied `keyword` and `status` filters, and the selected sort value. Tracker resources include current status, source, optional notes, timestamps, and the normalized job card shape used by saved jobs and job search.

### AI

| Method | Path                     | Auth          | Purpose                                        |
| ------ | ------------------------ | ------------- | ---------------------------------------------- |
| `POST` | `/api/v1/ai/job-fit`     | Authenticated | Analyze user fit for a selected job            |
| `POST` | `/api/v1/ai/cv-analyzer` | Authenticated | Analyze uploaded PDF CV against a selected job |

AI analysis endpoints use the standard response envelope. `POST /api/v1/ai/job-fit` accepts only `jobId` plus optional `persistResult`, returns `409 PROFILE_INCOMPLETE` or `409 PREFERENCES_INCOMPLETE` when required persisted context is missing, and stores sanitized snapshots only when `persistResult=true`.

`POST /api/v1/ai/cv-analyzer` requires `multipart/form-data` with metadata fields plus a single `cvFile` upload for `UPLOAD` mode. The endpoint accepts only PDF uploads, rejects oversized files with `413 PAYLOAD_TOO_LARGE`, returns `404 BOOKMARK_NOT_FOUND` when `compareSource=BOOKMARK` points to another user's bookmark, and returns `422 VALIDATION_ERROR` for unsupported `REFERENCE` mode until reusable CV references are enabled.

## Contract Stability Rules

- Do not remove response fields without a versioning plan.
- Do not change field meaning without a versioning plan.
- Additive fields are allowed when they are optional for existing consumers.
- Error `code` values must be stable.
- Query enum changes must be reflected in module docs and validation schemas.
- API examples must stay valid JSON.

## Related Docs

- `docs/api-response-standard.md`
- `docs/overview.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/project-structure.md`
- `references/docs/overview/request-response-flows.mdx`
- `references/docs/overview/authentication-and-trust-boundaries.mdx`
