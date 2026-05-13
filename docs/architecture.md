---
title: Backend API Architecture
description: Runtime architecture, request lifecycle, service boundaries, and cross-cutting backend concerns for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/architecture.md
last_reviewed: 2026-04-22
---

# Backend API Architecture

The Bisakerja Backend API is the application and orchestration layer for product workflows. It exposes REST JSON endpoints to the Frontend UI, reads and writes PostgreSQL through Prisma, consumes normalized job records from the scraper-managed data layer, and calls the Model API for AI outputs.

The backend must keep product workflows stable even when scraper freshness or model inference is degraded. Search and tracker flows should continue when model inference is unavailable. AI flows should fail clearly without breaking unrelated authenticated workflows.

## Architecture Summary

```text
Users
  -> Frontend UI
      -> Backend API
          -> PostgreSQL
          -> Model API
          -> normalized job records from Scraper API

External Job Platforms
  -> Scraper API
      -> PostgreSQL
          -> Backend API
              -> Frontend UI
```

Core rules:

- Frontend UI calls only Backend API for application workflows.
- Backend API owns authentication, authorization, validation, workflow orchestration, response formatting, and backend-owned persistence.
- PostgreSQL stores user state, normalized job records, tracker data, and selected AI result snapshots.
- Scraper API owns external job collection and normalization before records are exposed to backend workflows.
- Model API owns inference output generation, not user authorization or transactional application state.

## Service Boundaries

| Boundary                    | Owner                     | Backend responsibility                                                                        |
| --------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| User browser to Frontend UI | Frontend UI               | Return frontend-safe API responses and never rely on client-only authorization                |
| Frontend UI to Backend API  | Backend API               | Authenticate, authorize, validate, execute workflows, and return stable REST JSON             |
| Backend API to PostgreSQL   | Backend API and Prisma    | Persist backend-owned records and read normalized job records through documented repositories |
| Backend API to Model API    | Backend API and Model API | Send minimal prepared inference payloads and map downstream failures clearly                  |
| Scraper API to PostgreSQL   | Scraper API               | Backend reads normalized job data and does not depend on source-specific raw payloads         |

## Backend Responsibilities

The Backend API owns:

- Public and authenticated REST API contracts under `/api/v1`.
- Auth, profile, preference, bookmark, application tracker, job discovery, AI job fit, skill gap, and AI CV Analyzer workflows.
- Request validation with Zod before business logic.
- Authorization and user ownership checks.
- Prisma repository access for backend-owned records.
- Product-friendly transformation of Model API responses.
- Error response shape, request id correlation, logging, and audit event emission.

The Backend API does not own:

- Frontend rendering behavior.
- External job scraping logic.
- Source-platform-specific raw job payload semantics.
- Model training or model artifact loading.
- Central Bisakerja Docs governance.

## Request Lifecycle

All HTTP requests should follow this lifecycle:

```text
HTTP request
  -> app middleware
  -> request id middleware
  -> security headers
  -> CORS
  -> body parser
  -> rate limiter
  -> route
  -> route-level auth middleware when required
  -> Zod validation middleware
  -> controller
  -> service
  -> repository or integration client
  -> Prisma or downstream service
  -> service result
  -> controller response formatter
  -> structured logger
  -> HTTP response
```

Failure lifecycle:

```text
Known error or unknown exception
  -> centralized error handler
  -> error classification
  -> safe error envelope
  -> structured log with request id
  -> optional audit event for sensitive workflows
```

Layer responsibilities:

| Layer              | Responsibility                                                                                                     | Must not do                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Route              | Declare URL, method, middleware stack, and controller binding                                                      | Hold business rules                                                       |
| Middleware         | Handle auth, rate limit, request id, parsing, CORS, validation, and request guards                                 | Query database for business workflow decisions except auth/session lookup |
| Controller         | Translate HTTP input into service calls and return response envelopes                                              | Contain domain rules or Prisma queries                                    |
| Service            | Own business rules, authorization decisions that require domain context, orchestration, and transaction boundaries | Depend on Express request/response objects                                |
| Repository         | Own Prisma queries and data persistence details                                                                    | Call external HTTP services or shape frontend responses                   |
| Integration client | Own downstream HTTP calls to Model API or future internal services                                                 | Enforce end-user authorization                                            |
| Error handler      | Map application errors to API error envelopes                                                                      | Leak secrets, stack traces, or raw downstream payloads                    |

## Core User-Facing Flows

### Job Search

```text
Frontend UI
  -> Backend API: GET /api/v1/jobs
  -> PostgreSQL: query normalized jobs
  -> Backend API: apply response envelope and pagination metadata
  -> Frontend UI: render result list
```

Rules:

- Works for guests and authenticated users.
- Depends on scraper freshness indirectly, not on live scraper availability.
- Returns normalized fields only.
- Does not expose raw external platform payloads.

### Job Detail

```text
Frontend UI
  -> Backend API: GET /api/v1/jobs/:jobId
  -> PostgreSQL: load normalized job, company, requirements, source metadata
  -> Backend API: return product-ready job detail
```

Rules:

- Must include enough normalized data for AI comparison workflows.
- Must not require frontend to interpret source-specific fields.

### Fit Score And Skill Gap

```text
Frontend UI
  -> Backend API: request fit analysis
  -> PostgreSQL: load user profile, preferences, and job record
  -> Backend API: build minimal inference payload
  -> Model API: compute fit, explanation, and skill gap
  -> Backend API: map model output to product response
  -> Frontend UI: render score and explanation
```

Rules:

- Requires authenticated user context.
- Backend remains the only service assembling inference payloads.
- Model API does not decide user authorization.
- Store result snapshots only when needed for history, repeat viewing, or product analytics.

### AI CV Analyzer

```text
Frontend UI
  -> Backend API: upload or reference CV and selected job
  -> Backend API: validate file, language option, user ownership, and selected job
  -> PostgreSQL: load user and job context
  -> Model API: analyze CV against job context
  -> Backend API: return CV summary, alignment, ATS score, keywords, quantification, and improvements
```

Rules:

- Requires authenticated user context.
- CV uploads are sensitive user data.
- File type, size, retention, and deletion policy must be enforced before implementation.
- Logs must not contain raw CV content.

### Application Tracker Update

```text
Frontend UI
  -> Backend API: create or update application record
  -> PostgreSQL: validate user ownership and persist state
  -> Backend API: return updated tracker state
```

Rules:

- Requires authenticated user context.
- Must be transactional and user-specific.
- Must keep working if Model API is unavailable.
- Invalid status transitions should return `409`.

## Cross-Cutting Backend Concerns

### Error Types

The backend should define application error types that map to response envelopes:

| Error type                | Default status | Example                                          |
| ------------------------- | -------------- | ------------------------------------------------ |
| `ValidationError`         | 422            | Zod request body failure                         |
| `BadRequestError`         | 400            | Unsupported filter combination                   |
| `AuthenticationError`     | 401            | Missing or invalid token/session                 |
| `AuthorizationError`      | 403            | User cannot access another user's record         |
| `NotFoundError`           | 404            | Job or application record not found              |
| `ConflictError`           | 409            | Duplicate bookmark or invalid tracker transition |
| `RateLimitError`          | 429            | Too many auth or AI requests                     |
| `DownstreamError`         | 502            | Model API returns invalid response               |
| `ServiceUnavailableError` | 503            | Database or Model API unavailable                |
| `InternalServerError`     | 500            | Unexpected server failure                        |

Every error response must follow `docs/api-response-standard.md` and include a request id.

### Request ID

- Generate a request id when the incoming request does not provide one.
- Propagate request id into logs, error responses, and downstream Model API calls.
- Use `x-request-id` by default, matching `docs/environment.md`.

### Rate Limiting

Rate limit policy should be endpoint-aware:

| Endpoint group         | Risk                      | Policy direction                  |
| ---------------------- | ------------------------- | --------------------------------- |
| General read endpoints | Traffic spike             | Moderate default limit            |
| Auth endpoints         | Credential abuse          | Strict limit                      |
| Password reset and OTP | Token abuse               | Strict limit plus audit logging   |
| AI endpoints           | Cost and latency          | Strict per-user and per-IP limit  |
| CV upload              | Resource and privacy risk | Strict limit plus file validation |

### CORS

- Allow only configured frontend origins from `CORS_ORIGINS`.
- Do not allow wildcard origins in production.
- Keep service-to-service credentials separate from browser-originated credentials.

### Security Headers

Use a security header middleware such as Helmet or equivalent. The exact package must be pinned during setup. Document any production exceptions before deployment.

### Password Hashing

- Passwords must be hashed with a reviewed password hashing package such as Argon2 or an approved equivalent.
- Store only password hashes, never plaintext passwords.
- Keep hashing parameters documented after package selection.
- Add migration or rehash policy if hashing parameters change later.

### Token Or Session Strategy

The backend uses a hybrid auth design:

- Short-lived signed access JWTs for ordinary authenticated API calls.
- Opaque refresh tokens stored in `HttpOnly` cookies and persisted server-side as hashes.
- Mandatory refresh token rotation on refresh.
- Logout and password reset invalidate refresh credentials server-side.
- Access tokens are not stored in `localStorage`; frontend storage should be memory-only.
- Refresh/logout cookie endpoints must enforce configured CORS origins and origin checks, with CSRF protection added before any cross-site cookie production deployment.

Service-to-service credentials for Model API and Scraper API remain separate from end-user credentials.

### Audit Logging

Audit-sensitive actions:

- Register, login, logout, password reset, and email verification.
- Profile, preference, and account setting changes.
- Bookmark and application tracker mutations.
- AI CV Analyzer upload and deletion events.
- Admin or internal service actions if added later.

Audit logs should capture actor id, action, resource type, resource id, request id, result, and timestamp. Do not log passwords, tokens, OTP values, raw CV content, or secrets.

### Validation

- Validate params, query, body, and relevant headers with Zod.
- Validate environment variables at startup.
- Validate downstream Model API responses before returning them to the frontend.
- Treat scraper-provided job data as normalized but still guard against missing fields in frontend-facing responses.

### Logging

- Use structured logs.
- Include request id, method, path, status, latency, user id when authenticated, and dependency failure context.
- Redact secrets, tokens, passwords, OTPs, CV content, and service credentials.

## Dependency Failure Mapping

| Failure                                     | User impact                        | Backend behavior                                                                    |
| ------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| PostgreSQL unavailable                      | Most workflows fail                | Return `503`, log dependency failure, keep health check degraded                    |
| Model API unavailable                       | AI workflows fail                  | Return `503` for AI endpoints; search and tracker remain available                  |
| Model API invalid response                  | AI result cannot be trusted        | Return `502`, log sanitized downstream response summary                             |
| Scraper data stale                          | Search still works with stale data | Return available normalized jobs and expose freshness metadata when documented      |
| External source unavailable                 | No direct request impact           | Backend should not fail live user requests solely because a source platform is down |
| Auth provider or email provider unavailable | Auth email flows degrade           | Return explicit safe error and audit failed operation                               |

## Health And Readiness

The backend should expose health endpoints after implementation:

| Endpoint            | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `GET /health/live`  | Basic process liveness                                 |
| `GET /health/ready` | Readiness check for database and critical dependencies |

Readiness should distinguish:

- Application process is running.
- Environment config is valid.
- PostgreSQL is reachable.
- Model API is reachable when AI workflows are expected to be active.

## Related Docs

- `docs/overview.md`
- `docs/project-structure.md`
- `docs/tech-stack.md`
- `docs/environment.md`
- `references/docs/overview/system-architecture.mdx`
- `references/docs/overview/service-interactions.mdx`
- `references/docs/overview/request-response-flows.mdx`
- `references/docs/overview/authentication-and-trust-boundaries.mdx`
