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

This document defines the initial technology direction for the Bisakerja Backend API. It does not pin package versions yet. Exact versions must be selected during project setup after compatibility checks for Bun, TypeScript, Prisma, Express.js, Zod, and the test runner.

## Core Stack

| Area           | Default choice | Purpose                                                                                              |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Runtime        | Bun            | Run TypeScript backend code and manage packages with a fast modern JavaScript runtime                |
| Language       | TypeScript     | Provide static typing for service contracts, module boundaries, and data transformations             |
| HTTP framework | Express.js     | Expose REST API routes for frontend and internal service workflows                                   |
| Database       | PostgreSQL     | Store application state, normalized jobs, user preferences, tracker data, and AI result snapshots    |
| ORM            | Prisma         | Define schema, migrations, typed database client, and data access conventions                        |
| Validation     | Zod            | Validate environment variables, request params, query strings, request bodies, and internal payloads |
| API style      | REST JSON      | Provide stable frontend-facing API contracts with consistent response envelopes                      |

## Package Categories

The exact packages must be pinned during setup. The categories below describe what the project needs and the preferred direction.

| Category               | Candidate package family                                        | Documentation requirement                                                          |
| ---------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| HTTP server            | `express`                                                       | Route structure, middleware order, error handler, and request lifecycle            |
| TypeScript tooling     | `typescript`, Bun runtime tooling                               | Strict compiler settings and path alias policy                                     |
| Environment validation | `zod`                                                           | `src/config/env.ts` schema with documented defaults and required secrets           |
| Database               | `prisma`, `@prisma/client`                                      | Migration workflow, generated client usage, seed strategy, and connection handling |
| Logging                | `pino` or equivalent structured logger                          | Request id, log level, redaction, and dependency failure logging                   |
| Security headers       | `helmet` or equivalent                                          | Default HTTP hardening behavior                                                    |
| CORS                   | `cors` or equivalent                                            | Allowed origins by environment                                                     |
| Rate limiting          | Express-compatible rate limiter                                 | Auth, password reset, OTP, upload, and AI endpoint protection                      |
| Password hashing       | `argon2` or another reviewed password hashing package           | Hashing parameters, upgrade policy, and test strategy                              |
| Token handling         | `jose`, JWT library, or session package selected by auth design | Token/session strategy must be documented before implementation                    |
| Upload handling        | Multipart parser compatible with Express and Bun                | CV upload limits, content-type validation, storage path, and retention             |
| Testing                | Bun test runner, `supertest`, or compatible test tooling        | Unit, integration, route, and contract test strategy                               |
| Linting and formatting | ESLint and Prettier compatible with TypeScript                  | CI checks and no-write validation commands                                         |
| API docs generation    | Zod/OpenAPI compatible tooling                                  | Generated references must preserve source metadata before sync                     |

## Versioning Policy

- Pin exact package versions in `package.json`; do not rely on floating `latest` ranges.
- Prefer actively maintained stable releases over release candidates.
- Record important package choices in this file after setup.
- Re-check compatibility when upgrading Bun, Prisma, Express.js, TypeScript, or Zod.
- Treat major package upgrades as documentation-affecting changes when they alter API behavior, runtime behavior, generated Prisma output, or validation behavior.

## Runtime Principles

- Use Bun as the default local runtime and package manager.
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

The final test command names must be documented after project setup.

## Documentation Requirements For Stack Setup

Before implementation begins, update this document with:

- Exact package versions selected.
- Final auth/session package decision.
- Final upload handling package decision.
- Final test runner and command names.
- Final OpenAPI generation approach.
- Known Bun compatibility constraints.

## Related Docs

- `docs/overview.md`
- `docs/environment.md`
- `docs/TODOS.md`
- `folder-structur-reference.md`
- `references/docs/references/integrations.mdx`
