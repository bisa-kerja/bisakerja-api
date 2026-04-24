---
title: Backend API Deployment Operations
description: Bun runtime, environment variables, PostgreSQL, Prisma migrations, Docker readiness, environment topology, release readiness, and rollback direction for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/operations/deployment.md
last_reviewed: 2026-04-24
---

# Backend API Deployment Operations

This document defines the initial deployment assumptions for the Bisakerja Backend API. The backend is expected to run as an Express.js application on Bun, with TypeScript source, PostgreSQL persistence, Prisma migrations, Zod environment validation, and explicit integration configuration for Model API and scraper-managed job data.

Exact hosting details remain open. This document defines the requirements that any local, staging, or production deployment target must satisfy.

## Deployment Principles

- Build and deploy a reproducible artifact from committed source and lockfile.
- Pin the Bun runtime target to `1.3.3` until an upgrade is explicitly tested.
- Validate environment variables before the server accepts traffic.
- Run Prisma migrations explicitly as a deployment step.
- Keep application startup separate from destructive or schema-mutating database work.
- Treat PostgreSQL as a critical dependency for readiness.
- Treat Model API degradation as AI-feature degradation, not automatic total backend failure.
- Make rollback direction explicit before production release.

## Environment Topology

| Environment | Purpose                | Deployment expectation                                                                               |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Local       | Developer workflow     | Bun runtime, local or shared development database, optional mock Model API, fixture-backed job data  |
| Test        | Automated verification | Isolated test database, deterministic fixtures, fake email provider, disposable upload path          |
| Staging     | Pre-release validation | Production-like config, non-production secrets, migrated staging database, real or staging Model API |
| Production  | User-facing runtime    | Managed secrets, strict CORS, monitored PostgreSQL, controlled migrations, real observability        |

Each environment must have separate secrets and database connections. Production secrets must never be reused in local, test, or staging.

## Runtime Artifact

The first implementation should define a deterministic build and start workflow.

Artifact requirements:

- Bun version is pinned to `1.3.3` or an explicitly approved replacement.
- Dependency lockfile is committed.
- TypeScript compiles or is run through a documented Bun-compatible runtime path.
- Prisma client is generated during build or deploy.
- Static public file serving is disabled unless explicitly needed.
- Upload storage path is configured outside the compiled application artifact.
- Source maps, if enabled, are not exposed publicly.

Startup sequence:

```text
process starts
  -> load environment
  -> validate environment with Zod
  -> initialize logger
  -> initialize Express app and middleware
  -> initialize Prisma client
  -> register routes
  -> expose health endpoints
  -> listen on configured port
```

The app should not apply production migrations automatically during ordinary startup unless a later deployment policy approves that behavior.

## Environment Variables

Deployment must provide all required variables documented in `docs/environment.md`.

Minimum production variable groups:

| Group            | Required before production                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| Application      | `APP_ENV`, `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_URL`, `FRONTEND_URL`         |
| Database         | `DATABASE_URL`, optional `DIRECT_DATABASE_URL` if pooling is used              |
| Auth             | Token/session secrets, auth TTLs, reset and verification TTLs                  |
| Security         | `CORS_ORIGINS`, request body limit, rate limit settings, trusted proxy setting |
| Model API        | `MODEL_API_BASE_URL`, timeout, service credential if required                  |
| Scraper/job data | Job freshness threshold and any internal scraper status credential if used     |
| Uploads          | Storage driver, upload path or bucket, max size, MIME allowlist, retention     |
| Email            | Provider, sender, and Resend credentials for auth email flows                  |
| Observability    | Log level, request id header, health timeout, error reporting DSN if used      |

Rules:

- Environment validation must fail fast when required values are missing.
- Production CORS must not allow wildcard origins.
- Production auth secrets must be long, random, and environment-specific.
- `MODEL_API_ENABLE_MOCK=true` is allowed for local and tests only.
- Test and production database URLs must be visibly distinct.

## PostgreSQL Connection

PostgreSQL is required for backend readiness.

Deployment requirements:

- Use managed or otherwise durable PostgreSQL for staging and production.
- Configure connection pool limits according to hosting capacity.
- Use SSL where required by the database provider.
- Keep migration access controlled.
- Ensure backups exist before production launch.
- Monitor connection failures, slow queries, and migration failures.

If a pooler is introduced, document whether Prisma uses `DATABASE_URL`, `DIRECT_DATABASE_URL`, or both for runtime and migrations.

## Prisma Migration Execution

Migrations must be explicit and auditable.

Recommended deploy flow:

```text
build artifact
  -> validate environment
  -> generate Prisma client
  -> verify migration status
  -> apply pending migrations
  -> run smoke checks
  -> shift traffic
```

Migration rules:

- Do not edit a migration after it has been shared or applied outside a local-only branch.
- Apply migrations to staging before production.
- Verify migrations against an empty test database in CI.
- For risky data migrations, create a written rollout and rollback note.
- Prefer expand-and-contract changes for fields used by live API contracts.
- Do not remove columns used by the currently deployed application without a compatibility window.

Rollback caution:

- Application rollback is usually easier than database rollback.
- Destructive migrations require a backup and a specific recovery plan.
- If a migration cannot be rolled back safely, document the forward-fix strategy before release.

## Docker Readiness

If Docker is used, the image should be production-ready rather than development-oriented.

Docker requirements:

- Use a Bun-compatible base image pinned by version or digest.
- Install dependencies with the lockfile.
- Generate Prisma client during build or entrypoint as documented.
- Run as a non-root user when feasible.
- Include only required runtime files.
- Exclude `.env`, tests, local uploads, and unnecessary source artifacts when not needed.
- Expose only the configured application port.
- Handle shutdown signals gracefully.
- Provide a health check using the liveness endpoint.

Container runtime rules:

- Secrets come from the environment or secret manager, not from the image.
- Upload storage must use a mounted volume or object storage when files must survive container replacement.
- Logs should go to stdout/stderr in structured format.

## Health And Readiness In Deployment

Deployment platforms should use health endpoints consistently.

| Endpoint                   | Deployment use                                |
| -------------------------- | --------------------------------------------- |
| `GET /health/live`         | Container or process liveness                 |
| `GET /health/ready`        | Traffic readiness and PostgreSQL availability |
| `GET /health/dependencies` | Internal debugging only if implemented        |

Readiness should fail for invalid environment or unavailable PostgreSQL. Model API failures should be represented as degraded dependency state unless the route being deployed is specifically AI-only.

## Dependency Deployment Assumptions

| Dependency       | Assumption                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Frontend UI      | Calls only Backend API under the configured `/api/v1` prefix                                 |
| PostgreSQL       | Available before backend receives production traffic                                         |
| Model API        | Reachable from backend for AI Job Fit and AI CV Analyzer; not required for public job search |
| Scraper/job data | Normalized job records are already in PostgreSQL or seeded for first testing                 |
| Email provider   | Required before email verification, forgot password, or reset password is enabled            |
| Upload storage   | Required before AI CV Analyzer file upload is enabled                                        |

Feature flags or route guards should prevent half-configured features from appearing ready.

## Pre-Deployment Checklist

Before deploying to staging or production:

- Package versions are pinned.
- Lockfile is committed.
- TypeScript build or runtime check passes.
- Unit tests pass.
- Route tests pass for implemented modules.
- Repository integration tests pass against migrated test database.
- Prisma migration verification passes.
- Downstream contract fixtures pass for Model API and normalized job data.
- Required environment variables are documented and configured.
- CORS origins match the target frontend.
- Auth/session strategy is documented.
- Upload storage and retention are documented if CV Analyzer is enabled.
- Health endpoints are implemented.
- Logs include request id and redact sensitive fields.

## GitHub Actions Delivery Workflow

The repository currently uses one validation workflow and one follow-up docs sync workflow.

Its purpose is to keep release hygiene and documentation delivery automated even before a hosting-specific deploy target is finalized.

Current workflow structure:

- `.github/workflows/ci.yml` runs on push to `develop` and `main`, plus pull requests targeting those branches.
- The same workflow contains a final `sync-docs` job that runs only for push events to `develop` or `main`, and only after the validation jobs succeed.

Current delivery behavior:

- reinstall dependencies with the pinned Bun runtime and committed lockfile during CI
- generate the Prisma client before typecheck or documentation validation so delivery checks match a clean runner state
- rerun Prisma validation, typecheck, docs generation, docs validation, and Scalar config validation
- fail if generated docs differ from committed artifacts
- run `bun run prisma:verify:migrations` against a PostgreSQL service container
- after successful CI verification, synchronize service-owned docs into the central `bisakerja-docs` repository through the final CI job

Because hosting details are still open, this workflow should be treated as delivery readiness and documentation publish automation rather than infrastructure deployment.

Workflow hardening rules:

- Keep workflow env overrides limited to values that are truly environment-specific for the job.
- Prefer repository defaults for unrelated secrets or optional config so CI does not drift from the validated application schema.

## Release Readiness Checklist

The release owner must confirm these before marking a release ready.

| Gate                   | Required evidence                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Docs complete          | Relevant docs in `docs/**` updated, metadata present, and synced-doc impact understood |
| API examples reviewed  | JSON examples parse and match `docs/api-response-standard.md`                          |
| Tests passing          | Unit, route, integration, contract, and smoke checks pass for implemented scope        |
| Migrations verified    | Prisma migrations apply to an empty test database and staging migration succeeds       |
| Env documented         | `.env.example`, `docs/environment.md`, and deployment secret configuration agree       |
| Security reviewed      | Auth, ownership, rate limits, CORS, upload, and sensitive logging rules checked        |
| Observability ready    | Request id, structured logs, health checks, and dependency failure visibility exist    |
| Rollback noted         | Application rollback and database forward-fix or rollback direction documented         |
| Dependencies reachable | PostgreSQL, Model API where required, email, and upload storage validated              |

## Smoke Checks After Deployment

Run smoke checks after every staging or production deploy.

Minimum checks:

- Liveness endpoint returns healthy.
- Readiness endpoint returns ready when PostgreSQL is available.
- Public job search returns a valid envelope.
- Auth-protected route rejects missing credentials with `401 UNAUTHENTICATED`.
- Implemented auth flow can complete in staging with test credentials.
- Implemented tracker or bookmark flow can write and read user-owned data in staging.
- AI endpoint returns success or documented degradation depending on Model API availability.
- Logs contain request id for each smoke check.

## Rollback Direction

Rollback plans depend on whether the release changed code only or code plus database schema.

| Change type               | Rollback direction                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Code only                 | Redeploy previous artifact and run smoke checks                                         |
| Additive migration        | Redeploy previous artifact if it remains compatible, then plan cleanup later            |
| Destructive migration     | Restore from backup or execute documented forward fix; do not assume automatic rollback |
| Config issue              | Restore previous environment values and restart or redeploy                             |
| Model API incompatibility | Roll back backend model client mapping or pin Model API version if available            |

Every production deployment should record the artifact version, migration version, environment change summary, and smoke test result.

## First Deployment Open Decisions

- Hosting provider for backend runtime.
- Whether Docker is required for all environments.
- Whether a compiled application artifact, container image, or direct Bun runtime deploy will become the production unit.
- Database pooler strategy and connection limits.
- Object storage provider for CV uploads if local storage is insufficient.
- Error reporting provider.
- Rollback automation level.

## Related Docs

- `docs/environment.md`
- `docs/tech-stack.md`
- `docs/project-structure.md`
- `docs/database.md`
- `docs/operations/testing.md`
- `docs/operations/security.md`
- `docs/operations/observability.md`
- `references/docs/operations/environments.mdx`
- `references/docs/operations/failure-scenarios.mdx`
