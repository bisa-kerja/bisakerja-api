---
title: Backend API Tech Stack
description: Initial technology choices, package categories, and versioning policy for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/tech-stack.md
last_reviewed: 2026-04-22
---

# Backend API Tech Stack

This document defines the initial technology direction for the Bisakerja Backend API. The runtime target, command naming, and baseline package versions are pinned here for reproducible local and CI verification.

## Core Stack

| Area           | Default choice | Purpose                                                                                              |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Runtime        | Bun `1.3.3`    | Run TypeScript backend code and manage packages with a fast modern JavaScript runtime                |
| Language       | TypeScript     | Provide static typing for service contracts, module boundaries, and data transformations             |
| HTTP framework | Express.js     | Expose REST API routes for frontend and internal service workflows                                   |
| Database       | PostgreSQL     | Store application state, normalized jobs, user preferences, tracker data, and AI result snapshots    |
| ORM            | Prisma         | Define schema, migrations, typed database client, and data access conventions                        |
| Validation     | Zod            | Validate environment variables, request params, query strings, request bodies, and internal payloads |
| API style      | REST JSON      | Provide stable frontend-facing API contracts with consistent response envelopes                      |

## Baseline Packages

All package versions are pinned exactly in `package.json`.

| Category               | Package/version                                               | Purpose                                                                 |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| HTTP server            | `express@5.2.1`                                               | Route structure, middleware order, error handler, and request lifecycle |
| TypeScript tooling     | `typescript@5.9.3`, `bun-types@1.3.3`                         | Strict compiler settings and Bun runtime type support                   |
| Environment validation | `zod@4.3.6`                                                   | Runtime config and request schema validation                            |
| Logging                | `pino@10.3.1`                                                 | Structured JSON logging with redaction                                  |
| Security headers       | `helmet@8.1.0`                                                | Default HTTP hardening headers                                          |
| CORS                   | `cors@2.8.5`                                                  | Allowed-origin enforcement and request id header exposure               |
| Rate limiting          | `express-rate-limit@8.2.1`                                    | Default, auth, upload, and AI limiter skeletons                         |
| Cookie parsing         | `cookie-parser@1.4.7`                                         | Parse refresh-token cookies on Express routes                           |
| Password hashing       | `argon2@0.44.0`                                               | Argon2id password hashing with documented cost parameters               |
| Token handling         | `jsonwebtoken@9.0.2`                                          | Sign and verify short-lived access JWTs                                 |
| Route test harness     | `node-mocks-http@1.17.2`                                      | Express route and middleware contract tests without a bound socket      |
| Linting and formatting | `eslint@10.2.1`, `typescript-eslint@8.59.0`, `prettier@3.8.3` | TypeScript linting and no-write format checks                           |
| API docs generation    | Not selected                                                  | OpenAPI generation source remains a later implementation decision       |

Planned but not yet installed packages:

| Category        | Candidate package family                         | Documentation requirement                                              |
| --------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Upload handling | Multipart parser compatible with Express and Bun | CV upload limits, content-type validation, storage path, and retention |

## Versioning Policy

- Pin exact package versions in `package.json`; do not rely on floating `latest` ranges.
- Pin Bun to `1.3.3` for the current scaffold and document any upgrade with compatibility checks.
- Prefer actively maintained stable releases over release candidates.
- Record important package choices in this file after setup.
- Re-check compatibility when upgrading Bun, Prisma, Express.js, TypeScript, or Zod.
- Treat major package upgrades as documentation-affecting changes when they alter API behavior, runtime behavior, generated Prisma output, or validation behavior.

## Runtime Principles

- Use Bun as the default local runtime and package manager.
- Commit `bun.lock` and use `bun install --frozen-lockfile` in reproducible verification.
- Keep TypeScript strict enough to catch API contract drift early.
- Do not hide runtime configuration behind undocumented defaults.
- Keep startup validation explicit: missing required environment variables should fail fast.
- Keep route handlers thin; business logic should live in services, and database access should live in repositories.

## Express.js Usage

Express.js should be documented and implemented as a thin HTTP boundary:

- Routes define URL shape and middleware stack.
- Zod validation runs before controller logic.
- Controllers translate HTTP input to service calls.
- Services own business rules and orchestration.
- Repositories own Prisma queries.
- A centralized error handler maps known errors to the API response standard.

## Zod Usage

Zod should be used for:

- Environment variable validation.
- Request params validation.
- Request query validation.
- Request body validation.
- Backend-to-Model API payload validation.
- Normalized response schema documentation where practical.

Zod schemas should live near the module they validate unless they are reused across modules.

## Prisma Usage

Prisma should be used for:

- Database schema definition.
- Migration management.
- Typed database access.
- Seed data for local development and integration tests.

Prisma model ownership must match backend documentation. Backend-owned models include users, profiles, preferences, bookmarks, applications, and persisted AI snapshots. Scraper-owned job data may still be read by the backend, but ownership must be documented clearly before write paths are implemented.

## Testing Direction

The testing stack must cover:

- Unit tests for pure services, validation helpers, and response formatting.
- Integration tests for Prisma-backed repositories.
- Route tests for API contracts, auth behavior, and error envelopes.
- Contract tests for Model API and Scraper API assumptions.
- Smoke tests for health, startup env validation, and database connectivity.

The project uses these script names for scaffold and CI wiring:

| Script                             | Purpose                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                | TypeScript contract validation                                                                                         |
| `bun run lint`                     | ESLint validation                                                                                                      |
| `bun run format:check`             | Formatter no-write validation                                                                                          |
| `bun test`                         | Default unit test command                                                                                              |
| `bun run test:unit`                | Unit tests                                                                                                             |
| `bun run test:routes`              | Express route/API contract tests                                                                                       |
| `bun run test:integration`         | Prisma-backed integration tests                                                                                        |
| `bun run test:contracts`           | Model API and scraper fixture contract tests                                                                           |
| `bun run test:smoke`               | Startup, env, health, and basic route smoke tests                                                                      |
| `bun run prisma:generate`          | Generate Prisma client into `src/generated/prisma`                                                                     |
| `bun run prisma:migrate:dev`       | Create/apply local migrations only                                                                                     |
| `bun run prisma:migrate:deploy`    | Apply existing migrations in test/staging/production style environments, typically against managed PostgreSQL          |
| `bun run prisma:seed`              | Seed deterministic local data for every Prisma table, including auth, user, jobs, applications, and AI history samples |
| `bun run prisma:validate`          | Validate Prisma schema syntax and configuration for the configured PostgreSQL URLs                                     |
| `bun run prisma:verify:migrations` | Verify migrations against an empty isolated test database                                                              |

## Formatting And Linting Policy

Code and configuration files use two-space indentation. Tabs are not used for JavaScript, TypeScript, CSS, SCSS, JSON, YAML, Markdown, or MDX files.

Formatting is enforced by Prettier with `tabWidth: 2` and `useTabs: false`. Editor behavior is aligned through `.editorconfig` so local editors and automated formatting produce the same indentation.

ESLint uses TypeScript-aware strict and stylistic presets for source and test files. The baseline also enforces consistent type imports, promise safety for floating or misused promises, `curly` blocks, and strict equality checks.

## Runtime Compatibility Notes

The project is pinned to Bun `1.3.3` in `package.json`. Local verification and CI should use the pinned runtime unless an upgrade is explicitly tested and documented.

Route tests currently use an in-memory Express request/response harness. This keeps middleware and envelope contracts deterministic while avoiding local socket permission differences in constrained execution environments. Bound-port smoke tests should remain part of runtime verification where local networking is allowed.

## Remaining Stack Decisions

- Final upload handling package decision.
- Final OpenAPI generation approach.
- Dependency audit command and CI integration.

## Related Docs

- `docs/overview.md`
- `docs/environment.md`
- `folder-structur-reference.md`
- `references/docs/references/integrations.mdx`
