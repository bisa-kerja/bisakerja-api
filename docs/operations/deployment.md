---
title: Backend API Deployment Operations
description: Bun runtime, environment variables, managed PostgreSQL, Prisma migrations, Docker readiness, environment topology, release readiness, and rollback direction for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/operations/deployment.md
last_reviewed: 2026-04-29
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

| Group            | Required before production                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Application      | `APP_ENV`, `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_URL`, `FRONTEND_URL`                                  |
| Database         | `DATABASE_URL`, `DIRECT_DATABASE_URL` if pooling is used, `SEED_USER_PASSWORD` when seed flows are used |
| Auth             | Token/session secrets, auth TTLs, reset and verification TTLs                                           |
| Security         | `CORS_ORIGINS`, request body limit, rate limit settings, trusted proxy setting                          |
| Model API        | `MODEL_API_BASE_URL`, timeout, service credential if required                                           |
| Scraper/job data | Job freshness threshold and any internal scraper status credential if used                              |
| Uploads          | Storage driver, upload path or bucket, max size, MIME allowlist, retention                              |
| Email            | Provider, sender, and Resend credentials for auth email flows                                           |
| Observability    | Log level, request id header, health timeout, error reporting DSN if used                               |

Rules:

- Environment validation must fail fast when required values are missing.
- Deployment env files should not depend on empty-string placeholders or runtime fallback behavior.
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

For managed providers such as Neon or Supabase, prefer this split:

- `DATABASE_URL` uses the provider pooler or standard runtime URL.
- `DIRECT_DATABASE_URL` uses the direct host when Prisma migrations should bypass the pooler.

If the provider does not require a separate direct connection, still write an explicit `DIRECT_DATABASE_URL` value so Prisma CLI, migrations, and seed flows use the same validated contract as runtime environments.

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

## Container Image Delivery

The repository publishes a runnable application image to GitHub Container Registry at `ghcr.io/bisa-kerja/bisakerja-api`.

Current image delivery rules:

- The image is built in GitHub Actions, not on the VPS.
- The deployment workflow publishes a stable branch tag that matches the branch being deployed.
- Every published image also gets a commit-specific tag in the form `sha-<git-sha>`.
- The VPS pulls the branch tag that matches the deployment workflow input or trigger branch.

This keeps the deployment unit reproducible and lets the VPS pull a known image tag directly from GHCR without rebuilding source code on the server.

Image pull requirements:

- The target host must be able to authenticate to GHCR if the package is private.
- The selected tag should be explicit for controlled roll-forward or rollback.
- Environment variables still come from the host or deployment platform, not from the image.

## Compose Runtime File

The repository provides one deployment Compose file:

| File                 | Runtime env file  | Default image tag | Port exposure default           |
| -------------------- | ----------------- | ----------------- | ------------------------------- |
| `docker-compose.yml` | `.env.production` | `develop`         | `127.0.0.1:${APP_PORT}:${PORT}` |

Current compose behavior:

- the app service reads `DATABASE_URL` and `DIRECT_DATABASE_URL` directly from `.env.production`
- uploaded CV files persist in a named volume mounted at `/app/storage/uploads`
- liveness uses `GET /health/live`
- the backend port binds to loopback by default, so it is intended to sit behind a reverse proxy or host-level tunnel
- the Compose topology no longer provisions a PostgreSQL container, so database durability and TLS are handled by the external provider
- the app container sets `no-new-privileges`
- log rotation is configured through Docker `json-file` options

Compose-only variables:

- `APP_IMAGE` overrides the image tag or digest to pull
- `APP_BIND_ADDRESS` controls the host bind address for the backend port
- `APP_PORT` overrides the published backend port
- `PORT` controls the HTTP port inside the app container and must match the internal Compose target and healthcheck

The current rollout still targets staging first, but it intentionally uses the same production-style Compose topology that will later be reused when the deployment branch changes to `main`.

## VPS Deployment Workflow

End-to-end deployment now lives in one dedicated workflow:

- `.github/workflows/deploy.yml`

Its scope is intentionally narrow:

- connect to the VPS through SSH
- write the runtime `.env.production` file from GitHub Actions secrets
- authenticate the VPS to GHCR
- pull the latest app image
- run `prisma migrate deploy`
- start or recreate the backend container
- run `GET /health/live` and `GET /health/ready` smoke checks from the host

The workflow uses one reusable shell entrypoint:

- `scripts/deploy/remote-deploy.sh`

That script keeps the server-side steps reviewable in the repository rather than burying all deployment logic inside YAML.

Required GitHub environment secrets for the active deploy environment:

- `DEPLOY_VPS_HOST`
- `DEPLOY_VPS_PORT`
- `DEPLOY_VPS_USERNAME`
- `DEPLOY_VPS_KEY`
- `DEPLOY_REMOTE_PATH`
- `DEPLOY_ENV_FILE`
- `GHCR_READ_PACKAGES_TOKEN`
- `GH_USERNAME`

Secret handling rules:

- `DEPLOY_ENV_FILE` should contain the full multi-line runtime env file that will be written to `${DEPLOY_REMOTE_PATH}/.env.production`.
- The current staging rollout expects that env file to declare `APP_ENV=staging`.
- `DEPLOY_VPS_KEY` should stay scoped to deployment only and be rotated independently of application secrets.
- `GHCR_READ_PACKAGES_TOKEN` should be scoped as narrowly as possible, ideally `read:packages`.
- The current workflow uses the GitHub environment `staging` while rollout is still being validated on the staging VPS.

Current release guard:

- `.github/workflows/deploy.yml` deploys `develop` automatically and supports manual runs only for validated branches.
- After staging validation is finished, the workflow trigger can be switched to `main` without introducing another Compose file or another deployment workflow.

Remote host expectations:

- Docker Engine and Docker Compose v2 are installed.
- The target path already contains a checkout of this repository.
- The deploy user can run `docker` and write within the target path.
- The target path contains `docker-compose.yml` and receives updates through `git pull`.
- The published `APP_PORT` is reachable locally on the VPS for smoke checks, whether or not an external reverse proxy sits in front of it.
- The staging VPS should not share the same Docker project namespace, env file, or repository path with any later production rollout host.

## Health And Readiness In Deployment

Deployment platforms should use health endpoints consistently.

| Endpoint            | Deployment use                                |
| ------------------- | --------------------------------------------- |
| `GET /health/live`  | Container or process liveness                 |
| `GET /health/ready` | Traffic readiness and PostgreSQL availability |

Readiness should fail for invalid environment or unavailable PostgreSQL. Model API failures should surface through route-level errors and logs; they do not currently block the global readiness endpoint.

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

The repository currently uses one validation workflow and one deployment workflow.

Its purpose is to keep release hygiene and documentation delivery automated even before a hosting-specific deploy target is finalized.

Current workflow structure:

- `.github/workflows/ci.yml` runs on push to `develop` and `main`, plus pull requests targeting those branches.
- `.github/workflows/deploy.yml` runs on push to `develop` and can also be triggered manually for validated branches.
- The final `sync-docs` job in `CI` runs only after the validation jobs succeed.
- The deployment workflow is responsible for publishing the rollout image and deploying it to the active VPS environment.

Current delivery behavior:

- reinstall dependencies with the pinned Bun runtime and committed lockfile during CI
- generate the Prisma client before typecheck or documentation validation so delivery checks match a clean runner state
- rerun Prisma validation, typecheck, docs generation, docs validation, and Scalar config validation
- fail if generated docs differ from committed artifacts
- run `bun run prisma:verify:migrations` against a PostgreSQL service container
- synchronize service-owned docs into the central `bisakerja-docs` repository through the final CI job
- in the deployment workflow, build and push the repository Docker image, then SSH once into the VPS to write `.env.production`, log in to GHCR, and run the remote deploy script
- keep the deploy logic auditable by storing the remote steps in `scripts/deploy/remote-deploy.sh`
- the workflow writes `.env.production` and deploys through `docker-compose.yml`

Because the server topology intentionally reuses one simple production-style Compose model, the current deployment automation should be treated as a safe baseline for staging-first VPS rollout, not as a full blue-green or rollback-automated release system.

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
