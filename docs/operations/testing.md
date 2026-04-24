---
title: Backend API Testing Strategy
description: Unit, route, integration, database, migration, downstream contract, smoke, and release verification strategy for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/operations/testing.md
last_reviewed: 2026-04-24
---

# Backend API Testing Strategy

This document defines the testing workflow for the Bisakerja Backend API. It covers the tools used in the repository, the current test folder structure, how to run each category of test, and the expected conventions when adding new coverage.

The goal is twofold:

- make the current backend easy to verify locally and in CI
- make test additions predictable for developers who are new to the codebase

## Testing Principles

- Test public API behavior through response envelopes, status codes, and documented payloads.
- Test service rules separately from Express request and response objects.
- Test Prisma repositories against an isolated PostgreSQL database, not against production-like shared data.
- Test Model API and Scraper API assumptions with contract fixtures before relying on live services.
- Test security-sensitive flows with both success and failure paths.
- Keep tests deterministic by using stable fixtures, isolated users, and predictable timestamps where possible.
- Never mark a release ready when migrations, route contracts, or auth ownership checks are unverified.

## Quick Start

For the most common local workflow:

1. Copy `.env.test.example` to a local test environment file if your setup needs it.
2. Run `bun test` for the default suite.
3. Run `bun run test:integration` when working on repository-backed behavior.
4. Run `bun run docs:check` after documentation changes.
5. Run `bun run prisma:verify:migrations` before changes that affect Prisma schema or migrations.

For documentation-related changes, also regenerate the committed artifacts when needed:

- `bun run docs:generate:openapi`
- `bun run docs:generate:routes`
- `bun run docs:generate:sync-readiness`
- `bun run docs:scalar:check-config`

If you preview or publish the documentation through Scalar Docs, keep `scalar.config.json` in sync with any new page, renamed page, or OpenAPI path move.

To preview the repo-managed docs site locally through Scalar Docs, use:

- `bun run docs:scalar:preview`

## Testing Tools

The repository uses a small set of testing tools and helpers:

| Tool or helper                      | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `bun test`                          | Primary test runner for unit, route, integration, contract, and smoke tests     |
| `tests/helpers/route.ts`            | In-memory route injection helper for exercising Express without binding a port  |
| `node-mocks-http`                   | Mock request and response objects used by the route injection harness           |
| Prisma + isolated PostgreSQL        | Repository and migration verification against real schema behavior              |
| `tests/helpers/test-environment.ts` | Guards that prevent accidental database test execution outside test-safe config |
| `tests/fixtures/**`                 | Synthetic fixture data for users, jobs, downstream contracts, and schemas       |

Use the shared helpers before introducing new test utilities. That keeps behavior consistent across modules and reduces duplicate harness code.

## Test Categories

| Category                     | Scope                                                                                   | Primary value                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unit tests                   | Pure functions, validators, response formatters, service rules with mocked repositories | Fast feedback and edge case coverage                           |
| Route tests                  | Express routes through HTTP-style requests                                              | API contract, auth middleware, validation, and error envelopes |
| Repository integration tests | Prisma queries against a test PostgreSQL database                                       | Schema, constraints, ownership filters, and transactions       |
| Module integration tests     | Controller, service, repository, and selected integration clients together              | Product workflow confidence                                    |
| Downstream contract tests    | Model API payload/response and normalized job fixture validation                        | Prevent integration drift                                      |
| Migration verification       | Prisma schema and migrations applied to an empty database                               | Deployment safety                                              |
| Smoke tests                  | Startup, env validation, health, readiness, and database connectivity                   | Release and runtime readiness                                  |
| Documentation checks         | Required docs, metadata, examples, and response standards                               | Keep docs sync-ready                                           |

## Current Test Layout

The repository already follows a stable test layout. New tests should fit into the closest existing folder before creating a new subtree.

```text
tests/
  helpers/
    config.ts
    prisma.ts
    route.ts
    test-environment.ts
  unit/
    ai-cv-analyzer/
    ai-job-fit/
    applications/
    auth/
    bookmarks/
    core/
    jobs/
    preferences/
    shared/
    users/
    fixtures/
  integration/
    routes/
    repositories/
    contracts/
  fixtures/
    jobs/
    model-api/
    scraper-api/
    users/
  smoke/
```

Rules:

- Unit tests should not require PostgreSQL.
- Route tests should use the shared route injection helper so requests pass through the Express middleware stack without binding a local port.
- Repository and workflow integration tests must use a test database.
- Contract fixtures must be versioned with the backend source code.
- Fixtures must not contain real user CVs, passwords, tokens, or production job source payloads.
- Test helpers should create data through repositories or seed utilities instead of relying on brittle global database state.

Placement guidance:

- Put pure validation, mapper, utility, and service-rule tests in `tests/unit/**`.
- Put end-to-end route behavior that should pass through middleware, auth, validation, and controller layers in `tests/integration/routes/**`.
- Put Prisma query and ownership assertions in `tests/integration/repositories/**`.
- Put downstream shape verification in `tests/integration/contracts/**`.
- Put startup and environment sanity checks in `tests/smoke/**`.

## Test Environment

Automated tests must run with `APP_ENV=test`.

Required test environment behavior:

| Area          | Rule                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Database      | Use an isolated test `DATABASE_URL`; never use local development, staging, or production databases |
| Auth          | Use deterministic secrets only for tests; never reuse staging or production secrets                |
| Email         | Use a fake or in-memory email provider                                                             |
| Model API     | Use `MODEL_API_ENABLE_MOCK=true` or a local fake service for most tests                            |
| Scraper data  | Use normalized job fixtures seeded into the test database                                          |
| Uploads       | Use a disposable test upload path outside tracked source files                                     |
| Logging       | Keep logs structured but reduce noise unless a test fails                                          |
| Time          | Prefer injectable clocks for token expiry, stale jobs, and retention tests                         |
| DB assertions | Require `RUN_DATABASE_TESTS=true`; ordinary full-suite runs skip database-backed repository checks |

The final `.env.test.example` should be created during scaffold work and kept in sync with `docs/environment.md` and `src/config/env.ts`.

Test helpers must fail fast when integration tests are configured outside the test runtime. Database-backed tests should call the environment guard before connecting to PostgreSQL, reject database URLs that do not clearly point to an isolated local or test database, and skip with an explicit reason when the configured PostgreSQL target is unavailable.

For database-backed verification, prefer explicit environment overrides so the active database target is obvious in terminal history. A managed test database is acceptable as long as it is isolated from development, staging, and production. Example:

- `APP_ENV=test NODE_ENV=test DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require DIRECT_DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require RUN_DATABASE_TESTS=true bun test`

The seeded route sweep mutates seeded auth and application state during execution. Always point it to an isolated test database, not to the normal local development database.

Reserved commands:

| Command                            | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `bun test`                         | Default unit test run                                 |
| `bun run test:unit`                | Unit tests                                            |
| `bun run test:routes`              | HTTP route contract tests                             |
| `bun run test:integration`         | Prisma-backed integration tests                       |
| `bun run test:contracts`           | Model API and scraper fixture contracts               |
| `bun run test:smoke`               | Startup, env, health, and basic route smoke checks    |
| `bun run prisma:verify:migrations` | Migration verification against an empty test database |
| `bun run docs:check`               | Frontmatter and JSON example validation for `docs/**` |

## GitHub Actions Coverage

The repository GitHub Actions CI workflow validates changes on:

- push to `develop`
- push to `main`
- pull requests targeting `develop`
- pull requests targeting `main`

Current CI workflow structure:

- `.github/workflows/ci.yml` contains repository quality validation, PostgreSQL-backed migration or repository verification, and final docs synchronization for push events to `develop` or `main`.
- `.github/workflows/deploy.yml` is separate from CI and handles build-plus-deploy for the current rollout branch, which is `develop`.

Current CI expectations:

- install dependencies with the committed Bun lockfile
- run `bun run prisma:generate` before static analysis so generated Prisma types exist in clean runners
- run `bun run prisma:validate`
- run `bun run lint`
- run `bun run format:check`
- run `bun run typecheck`
- regenerate `docs/generated/openapi.json`, `docs/generated/routes.md`, and `docs/generated/sync-readiness.md`
- expect `docs/generated/openapi.json` to be written with the repository Prettier rules so `bun run format:check` and the OpenAPI sync gate agree
- run Scalar config validation with Node.js 24 because the current Scalar CLI requires that runtime level
- run `bun run docs:check` and `bun run docs:scalar:check-config`
- fail if `docs/generated/openapi.json` changes after regeneration, because the committed OpenAPI artifact must stay in sync with source
- run `bun test`, `bun run test:routes`, `bun run test:contracts`, and `bun run test:smoke`
- run `bun run prisma:verify:migrations` in a separate PostgreSQL-backed job
- run docs sync only after both CI validation jobs succeed, and only for push events to `develop` or `main`

Current deployment workflow expectations:

- build and push `ghcr.io/bisa-kerja/bisakerja-api:<deploy-branch>`
- also push a commit-specific `sha-<git-sha>` image tag
- trigger automatically from `develop` and allow manual runs only for validated branches
- use the GitHub environment `staging` while the rollout is still validating on the staging VPS
- SSH into the target VPS with the configured VPS private key through one deploy action step
- write the runtime `.env.production` file from GitHub environment secrets
- reject rollout when the runtime env file does not declare `APP_ENV=staging` for the current staging target
- authenticate the VPS to GHCR, pull the latest image, run `prisma migrate deploy`, and start the app through app-only `docker compose`
- verify `GET /health/live` and `GET /health/ready` from the VPS after deployment

When the staging rollout is considered stable, the deploy trigger can be moved from `develop` to `main` without introducing a second deployment topology.

The route inventory and sync-readiness markdown files are still regenerated in CI and CD, but they are not used as a clean-working-tree gate because they intentionally embed runtime metadata such as generation timestamps and source references.

This split keeps fast feedback for most checks while still proving that committed Prisma migrations and repository integration tests work against a real PostgreSQL service in CI, while deployment-specific concerns stay in their own workflows.

Workflow safety notes:

- CI intentionally keeps workflow env overrides minimal and lets the validated repo defaults cover non-essential secrets or tokens.
- CI generates the Prisma client before lint, typecheck, or docs generation so clean runners do not depend on committed generated build artifacts.
- Repository integration tests should import repository files directly when possible, rather than broad module barrels, so CI does not evaluate unrelated route or controller wiring during repository-only verification.

## Choosing The Right Test Type

Use the lightest test that can prove the behavior you changed:

| If you changed...                                        | Prefer this test type first |
| -------------------------------------------------------- | --------------------------- |
| Zod validation, mapper logic, pure helper                | Unit test                   |
| Controller wiring, auth, status code, envelope           | Route test                  |
| Prisma filtering, transactions, ownership at query level | Repository integration test |
| Model API fixture shape or downstream schema contract    | Contract test               |
| App startup, liveness, readiness, env guard              | Smoke test                  |

When a bug crosses layers, combine test types instead of overloading one large route suite.

## Running Tests

Common commands:

| Command                            | When to use it                                                 |
| ---------------------------------- | -------------------------------------------------------------- |
| `bun test`                         | Default project-wide run                                       |
| `bun run test:unit`                | Fast feedback for schema, service, utility, and mapper changes |
| `bun run test:routes`              | HTTP contract, middleware, auth, and validation behavior       |
| `bun run test:integration`         | Prisma-backed repository and route integration suites          |
| `bun run test:contracts`           | Model API and fixture contract verification                    |
| `bun run test:smoke`               | Startup and environment-level checks                           |
| `bun run docs:check`               | Documentation validation after doc changes                     |
| `bun run prisma:verify:migrations` | Prisma migration and repository verification before release    |

If you only changed one area, run the smallest relevant subset first, then expand to the broader suite before considering the task done.

For PostgreSQL-backed local verification, this staged sequence is the preferred order:

1. `bun run typecheck`
2. `APP_ENV=test NODE_ENV=test DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require DIRECT_DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require RUN_DATABASE_TESTS=true bun test tests/integration/repositories`
3. `APP_ENV=test NODE_ENV=test DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require DIRECT_DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require RUN_DATABASE_TESTS=true bun test tests/integration/routes/seeded-prisma-sweep.test.ts`
4. `APP_ENV=test NODE_ENV=test DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require DIRECT_DATABASE_URL=postgresql://app_user:password@ep-test-breeze-a1b2c3d4.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require RUN_DATABASE_TESTS=true bun test`

## Writing A New Test

Recommended workflow when adding a new test:

1. Identify the lowest layer where the bug or rule can be reproduced safely.
2. Reuse existing fixtures and helpers before adding new custom setup.
3. Name the test file after the module or behavior under test.
4. Assert status code, response envelope, and important fields together for route behavior.
5. Add at least one negative-path assertion when the feature has auth, validation, or ownership rules.

Route test example:

```ts
import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("health routes", () => {
  test("returns liveness envelope", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/health/live"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Service is live",
      data: {
        service: "bisakerja-api",
        status: "live",
        env: "test"
      },
      meta: null
    });
  });
});
```

Schema or unit-style test example:

```ts
import { describe, expect, test } from "bun:test";

import { registerSchema } from "@/modules/auth/auth.schema";

describe("register schema", () => {
  test("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({
      username: "salman",
      email: "salman@example.com",
      phoneNumber: "+6281234567890",
      password: "StrongPassword123!",
      confirmPassword: "DifferentPassword123!"
    });

    expect(result.success).toBe(false);
  });
});
```

## Adding A Test File

When adding a new test file:

- mirror the module path and naming style that already exists
- prefer one responsibility per file
- keep fixtures synthetic and product-shaped
- keep repository tests guarded by the existing test-environment helpers
- avoid binding a real HTTP port when `tests/helpers/route.ts` is sufficient

## Database Test Setup

Repository and workflow tests should validate the real Prisma schema and constraints.

Minimum database setup:

1. Create a dedicated test database.
2. Apply Prisma migrations to the test database before integration tests.
3. Generate Prisma client before test execution.
4. Seed only the records required by each test suite.
5. Clean data between tests through transactions, truncation, or isolated schemas.
6. Fail fast if `DATABASE_URL` does not point to an approved test database pattern.

Recommended fixture groups:

| Fixture               | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `testUser`            | Authenticated user with verified email                            |
| `secondUser`          | Ownership and authorization negative cases                        |
| `profileCompleteUser` | AI job fit and CV analyzer context                                |
| `sourcePlatforms`     | Glints, Jobstreet, Kalibrr, and Dealls normalized source metadata |
| `companyAndJobs`      | Search, detail, bookmark, tracker, and AI context                 |
| `expiredJob`          | Stale and inactive job behavior                                   |
| `modelResponses`      | Valid, invalid, timeout, and degraded AI responses                |

## Prisma Migration Verification

Migrations must be verified before deployment and before any database-backed test run.

Required checks:

- Prisma schema syntax is valid.
- Prisma client generation succeeds.
- Migrations apply cleanly to an empty PostgreSQL database.
- Migration history is not edited after it is shared.
- Database constraints match documented uniqueness and ownership rules.
- Rollback notes exist for risky migrations, even when rollback is manual.

The initial implementation should provide a command equivalent to:

```text
verify migrations -> generate Prisma client -> apply migrations to test database -> run repository integration tests
```

The reserved command name for this flow is `bun run prisma:verify:migrations`.

The current migration verification command validates the Prisma schema, generates the client, applies committed migrations through Prisma Migrate deploy, and runs repository integration tests. It requires `APP_ENV=test` and an isolated PostgreSQL `DATABASE_URL`. Repository tests run database-backed assertions only when `RUN_DATABASE_TESTS=true`; ordinary full test runs keep this flag disabled and skip them with an explicit reason. Release verification should run against a real empty test database, whether that database is provisioned on localhost or on a managed PostgreSQL provider.

Production deployment must use explicit migration execution, not implicit application startup mutation, unless a later approved deployment policy says otherwise.

## Route Test Requirements

Route tests should exercise the Express app through compatible Bun test tooling. The initial route harness uses in-memory Express request and response objects so middleware order, headers, envelopes, and error handling can be verified without depending on a bound local socket.

The shared route harness should live under `tests/helpers/route.ts` and return the response status, headers, and parsed JSON body. Individual route suites should avoid duplicating Express injection code unless a test requires lower-level middleware control.

Every route group must verify:

- Correct `/api/v1` prefix.
- Required authentication behavior.
- Zod validation errors use the standard `422` envelope.
- Known business errors map to documented status codes and error codes.
- Successful responses match `docs/api-response-standard.md`.
- List endpoints include pagination, filter, and sort metadata when applicable.
- Error responses include `error.requestId`.
- Sensitive fields are not returned.

Authentication route tests must verify registration, duplicate handling, weak password validation, email verification, login failures, access-token auth middleware behavior, refresh-token rotation, logout invalidation, password reset, Google SSO placeholder behavior, sensitive response safety, and strict auth route rate limits.

Bound-port smoke tests should be added for startup and health behavior when the pinned Bun runtime is available in CI.

## Downstream Contract Tests

### Model API

AI-related tests should avoid depending on a live Model API for normal CI.

Contract tests must verify:

- Backend sends only the minimum required profile, preference, job, and CV context.
- Request id is forwarded to the Model API client.
- Fit score responses are normalized to score range `0` to `100`.
- Skill gap responses include matched skills, missing skills, and recommendations when available.
- CV Analyzer responses include overall impression, job fit alignment, ATS score, keyword feedback, quantification feedback, and actionable improvements.
- Invalid model output maps to `502 DOWNSTREAM_ERROR`.
- Timeout or unavailable model service maps to `503 SERVICE_UNAVAILABLE` when the dependency is unavailable.

### Scraper And Job Data

Backend tests should use normalized database fixtures instead of raw platform payloads.

Contract tests must verify:

- `sourcePlatformId` plus `externalJobId` uniquely identifies a normalized job.
- Job records include source platform, company, title, location, work type, source URL, and freshness fields when available.
- Missing optional source fields do not break frontend-facing job responses.
- Raw Glints, Jobstreet, Kalibrr, or Dealls payloads do not leak through API responses.
- Stale job behavior follows the documented `JOB_STALE_AFTER_HOURS` rule.

## Fixture Safety

Shared fixtures should be small, synthetic, and product-shaped. User fixtures may contain stable test emails under non-routable domains but must not contain passwords, password hashes, OTP values, refresh tokens, or access tokens. CV analyzer fixtures must not include raw CV content. Scraper fixtures must represent normalized job data only and must not include raw provider payloads.

The fixture baseline should include:

| Fixture path                 | Expected content                                                               |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `tests/fixtures/users`       | Synthetic users for authenticated, second-user, and profile-complete scenarios |
| `tests/fixtures/jobs`        | Source platform metadata and normalized job records                            |
| `tests/fixtures/model-api`   | Valid and degraded model responses for contract validation                     |
| `tests/fixtures/scraper-api` | Normalized scraper job records derived from job fixtures                       |

## MVP Module Validation Matrix

Each MVP module must have at least one documented validation path before implementation is considered ready.

| Module         | Minimum validation path                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | Route test for register/login plus negative tests for invalid credentials, duplicate email, rate limit, and no plaintext password storage                         |
| Users          | Route and repository tests for current-user profile read/update, onboarding completion state, skill upsert, and user ownership                                    |
| Preferences    | Route and service tests for full preference save, enum validation, salary range validation, and single active preference set                                      |
| Jobs           | Route and repository tests for list filters, pagination, sorting, detail lookup, stale/fresh metadata, and no raw source payload leakage                          |
| Bookmarks      | Route and repository tests for save, duplicate save conflict or idempotency decision, unsave, saved list, and user ownership                                      |
| Applications   | Route and service tests for create tracker record, update notes, status transition, duplicate active record handling, and user ownership                          |
| AI Job Fit     | Service and route tests for payload preparation, Model API success, invalid model response, timeout, score normalization, and optional snapshot persistence       |
| AI CV Analyzer | Route and service tests for upload validation, selected job lookup, Model API success, invalid model response, timeout, retention metadata, and no raw CV logging |
| Health         | Smoke tests for liveness, readiness, PostgreSQL dependency status, and degraded downstream dependency reporting                                                   |

Health route tests should cover liveness without dependency checks, readiness success with PostgreSQL healthy, and readiness failure mapping to `503 SERVICE_UNAVAILABLE` when PostgreSQL is unavailable. Smoke checks may inject a healthy database check in constrained environments that do not provide PostgreSQL, while repository and migration verification still require a real isolated test database.

## Security Test Requirements

Security-sensitive behavior must have automated tests before the corresponding feature is considered done.

Required security test cases:

- Unauthenticated users cannot access profile, preference, bookmark, tracker, AI job fit, or CV analyzer routes.
- Protected routes reject missing, malformed, invalid, and expired access tokens with `401 UNAUTHENTICATED`.
- Authenticated users cannot read or mutate another user's records.
- Password reset and email verification tokens expire.
- Token or session logout invalidates future use according to the selected auth strategy.
- CORS rejects disallowed origins in production-like configuration.
- Refresh cookie responses honor configured `Secure` and `SameSite` flags.
- Upload validation rejects unsupported MIME types, oversized files, and missing files.
- Error and audit log assertions verify that responses do not include stack traces, secrets, tokens, OTP values, raw CV contents, or raw downstream payloads.

## Smoke Tests

Smoke tests should be fast and safe enough to run after deployment.

Minimum smoke checks:

| Check                     | Expected result                                                        |
| ------------------------- | ---------------------------------------------------------------------- |
| Startup env validation    | Server refuses invalid required configuration                          |
| Liveness endpoint         | Returns healthy process status without requiring downstream services   |
| Readiness endpoint        | Returns PostgreSQL readiness and dependency degradation details        |
| Database connectivity     | Backend can run a lightweight PostgreSQL check                         |
| Public jobs endpoint      | Returns a valid response envelope even when no jobs exist              |
| Auth protected route      | Rejects unauthenticated request with `401 UNAUTHENTICATED`             |
| Model dependency degraded | AI route returns documented `502` or `503` without breaking job search |

## Release Test Gate

A release candidate cannot be marked ready until these checks pass:

- Unit tests pass.
- Route tests pass for all implemented endpoint groups.
- Repository integration tests pass against a migrated test database.
- Prisma migration verification passes.
- Downstream contract fixtures pass.
- Smoke tests pass in the target environment or a production-like staging environment.
- Security-sensitive tests pass for implemented auth, upload, and ownership flows.
- API examples in docs remain valid JSON and match response standards.
- Documentation metadata checks pass and generated route inventory is refreshed when route registration changes.

## Coverage Expectations

Coverage targets should be used as a guardrail, not a substitute for meaningful tests.

Initial expectations:

- High coverage for response formatters, validation schemas, auth rules, and ownership checks.
- Focused branch coverage for failure mapping and downstream dependency behavior.
- Route coverage for every public and authenticated API group.
- Repository tests for all non-trivial Prisma queries, uniqueness constraints, and transactions.

## Related Docs

- `docs/project-structure.md`
- `docs/tech-stack.md`
- `docs/environment.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/auth.md`
- `docs/modules/ai-job-fit.md`
- `docs/modules/ai-cv-analyzer.md`
- `docs/integrations/model-api.md`
- `docs/integrations/scraper-api.md`
- `references/docs/operations/failure-scenarios.mdx`
