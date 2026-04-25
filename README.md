# Bisakerja API

Backend API for the Bisakerja platform. This service owns authentication, user workflows, job discovery API contracts, application tracking, AI workflow orchestration, persistence access, runtime validation, and the public REST boundary consumed by the frontend.

Bisakerja is an AI-assisted career decision platform for Indonesian job seekers. The backend exists to provide a stable product API for finding relevant jobs, understanding job fit, improving CV quality, and tracking application outcomes.

## Table of Contents

- [Overview](#overview)
- [Platform Context](#platform-context)
- [Service Boundary](#service-boundary)
- [MVP Modules](#mvp-modules)
- [API Surface](#api-surface)
- [Documentation Map](#documentation-map)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Database Workflow](#database-workflow)
- [Available Scripts](#available-scripts)
- [Testing And Verification](#testing-and-verification)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Deployment Notes](#deployment-notes)
- [Contribution Guide](#contribution-guide)

## Overview

The Bisakerja Backend API is the main application backend for Bisakerja. It provides the frontend-facing REST API, validates user input, enforces authentication and ownership rules, formats consistent API responses, and coordinates data access through PostgreSQL and Prisma.

This repository is responsible for:

- Auth, session, email verification, and password reset workflows
- User profile, preference, bookmark, and application tracker workflows
- Job search and job detail access over normalized job records
- AI job fit and AI CV analyzer orchestration through the Model API boundary
- Prisma schema, migrations, seed data, and repository-level persistence logic
- Service-owned technical documentation and generated API artifacts
- Docker-based runtime deployment support for a VPS-style environment

The backend should not behave as a generic pass-through proxy. It should shape responses around product workflows, protect private user data, and translate downstream failures into frontend-safe API responses.

## Platform Context

Bisakerja is positioned as a decision layer for Indonesian job seekers, not only as a job listing interface. The product combines job discovery, profile and preference context, fit scoring, explainable recommendations, CV feedback, and application tracking.

The broader platform includes:

| Service     | Responsibility                                                              |
| ----------- | --------------------------------------------------------------------------- |
| Frontend UI | Presents discovery, fit analysis, CV analysis, preferences, and tracking UI |
| Backend API | Owns business workflows, auth, persistence access, and API contracts        |
| Scraper API | Collects and normalizes external job data                                   |
| Model API   | Produces fit scores, explanations, skill gaps, and CV analysis output       |
| PostgreSQL  | Stores users, jobs, preferences, applications, and AI result snapshots      |

The frontend calls the Backend API for product workflows. It must not call Scraper API or Model API directly.

## Service Boundary

The Backend API owns:

- Authentication and authorization decisions
- User profile, preference, bookmark, and application tracker workflows
- Backend-facing validation with Zod
- API response formatting and error mapping
- Prisma-based database access for backend-owned records
- Product-friendly formatting of Model API outputs
- Read access to normalized job records required by search, detail, and AI workflows

The Backend API does not own:

- Frontend rendering or client-side state
- Scraping, parsing, and normalization logic for external job platforms
- Model training, model artifact management, or low-level inference internals
- Central platform documentation governance outside service-owned backend docs

## MVP Modules

| Module         | Responsibility                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| Auth           | Register, login, logout, refresh/session, password reset, email verification   |
| Users          | Account profile, onboarding state, career background, skills, and education    |
| Preferences    | Career status, target roles, locations, work types, salary, and notifications  |
| Jobs           | Search, filter, sort, list, detail, company data, source data, and apply links |
| Bookmarks      | Save, remove, list saved jobs, duplicate handling, and ownership checks        |
| Applications   | Track user-specific applications, status changes, and status history           |
| AI Job Fit     | Prepare inference context and return fit score, skill gap, and next steps      |
| AI CV Analyzer | Analyze uploaded CV PDFs against a selected job and return improvement signals |
| Health         | Liveness and readiness endpoints                                               |

Future modules such as mentoring, notification expansion, analytics, payments, and direct ATS integration are documented as future scope and should not block MVP behavior.

## API Surface

Default local base URL:

```text
http://localhost:3000/api/v1
```

Key route groups:

| Route group    | Prefix                          | Auth class                               |
| -------------- | ------------------------------- | ---------------------------------------- |
| Health         | `/health/live`, `/health/ready` | Public or infrastructure-restricted      |
| Auth           | `/api/v1/auth`                  | Public plus authenticated session routes |
| Users          | `/api/v1/me`                    | Authenticated                            |
| Preferences    | `/api/v1/me/preferences`        | Authenticated                            |
| Jobs           | `/api/v1/jobs`                  | Public for search and detail             |
| Bookmarks      | `/api/v1/me/bookmarks`          | Authenticated and ownership-protected    |
| Applications   | `/api/v1/me/applications`       | Authenticated and ownership-protected    |
| AI Job Fit     | `/api/v1/ai/job-fit`            | Authenticated                            |
| AI CV Analyzer | `/api/v1/ai/cv-analyzer`        | Authenticated                            |

JSON responses use a consistent envelope with `success`, `message`, `data`, `meta`, and `error` fields. See `docs/api-response-standard.md` for the full response contract.

## Documentation Map

Use this reading order when onboarding or reviewing changes:

1. `docs/overview.md` for service purpose, scope, and ownership boundaries.
2. `docs/api-reference.md` for route groups, auth classification, API docs, and generated contract workflow.
3. `docs/project-structure.md` for folder layout, module anatomy, and dependency direction.
4. `docs/environment.md` for runtime variables and environment separation.
5. `docs/database.md` for Prisma, PostgreSQL, entity ownership, and migration policy.
6. `docs/operations/testing.md` for test strategy and verification commands.
7. `docs/operations/deployment.md` for runtime deployment assumptions.
8. `docs/modules/*.md` for module-specific behavior and endpoint details.
9. `docs/generated/openapi.json` and `docs/generated/routes.md` for generated API artifacts.

## Tech Stack

| Area           | Choice                     |
| -------------- | -------------------------- |
| Runtime        | Bun `1.3.3`                |
| Language       | TypeScript                 |
| HTTP framework | Express.js `5`             |
| Database       | PostgreSQL                 |
| ORM            | Prisma `7`                 |
| Validation     | Zod                        |
| Logging        | Pino                       |
| Security       | Helmet, CORS, rate limits  |
| Auth           | JWT, refresh-token cookies |
| Email          | Fake provider or Resend    |
| API docs       | OpenAPI and Scalar         |
| Testing        | `bun test`                 |
| Formatting     | Prettier                   |
| Linting        | ESLint                     |

## Getting Started

Install dependencies:

```bash
bun install
```

Create local environment files:

```bash
cp .env.example .env
cp .env.test.example .env.test
```

Generate the Prisma client:

```bash
bun run prisma:generate
```

Apply migrations to your configured development database:

```bash
bun run prisma:migrate:dev
```

Seed deterministic local data:

```bash
bun run prisma:seed
```

Start the API in watch mode:

```bash
bun run dev
```

Start the API without watch mode:

```bash
bun run start
```

The default local API runs at:

```text
http://localhost:3000
```

## Environment Configuration

The app validates environment variables at startup. Missing required values or invalid values should fail before the server accepts requests.

Important local files:

| File                      | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `.env.example`            | Local development baseline                      |
| `.env.test.example`       | Test environment baseline                       |
| `.env.production.example` | Deployment-oriented baseline for Docker Compose |

Important variable groups:

- Application: `APP_ENV`, `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_URL`, `FRONTEND_URL`
- Database: `DATABASE_URL`, optional `DIRECT_DATABASE_URL`, `RUN_DATABASE_TESTS`
- Auth: access-token secret, refresh-token secret, TTLs, cookie settings
- Security: CORS origins, trusted proxy, body limit, rate limit settings
- Integrations: Model API URL, scraper/job source settings, email provider
- Uploads: storage driver, upload path, CV limits, retention
- Observability: log level, request id header, health timeout

Do not commit real secrets or production database credentials.

## Database Workflow

PostgreSQL is the durable source of truth. Runtime environments are expected to use managed or externally hosted PostgreSQL through `DATABASE_URL`.

For providers such as Neon or Supabase:

- Use `DATABASE_URL` for the runtime connection, usually the provider pooler URL.
- Use `DIRECT_DATABASE_URL` for Prisma migrations when the provider recommends a direct host.
- Use a separate database for tests.
- Keep `RUN_DATABASE_TESTS=false` for ordinary local test runs unless an isolated test database is prepared.

Common commands:

```bash
bun run prisma:validate
bun run prisma:generate
bun run prisma:migrate:dev
bun run prisma:migrate:deploy
bun run prisma:seed
bun run prisma:verify:migrations
```

## Available Scripts

| Script                          | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `bun run dev`                   | Start the API in watch mode                                |
| `bun run start`                 | Start the API                                              |
| `bun run typecheck`             | Run TypeScript contract checks                             |
| `bun run lint`                  | Run ESLint                                                 |
| `bun run format`                | Format files with Prettier                                 |
| `bun run format:check`          | Check formatting without writing                           |
| `bun test`                      | Run the default test suite                                 |
| `bun run test:unit`             | Run unit tests                                             |
| `bun run test:routes`           | Run route/API contract tests                               |
| `bun run test:integration`      | Run integration tests                                      |
| `bun run test:contracts`        | Run downstream contract tests                              |
| `bun run test:smoke`            | Run smoke tests                                            |
| `bun run docs:generate:openapi` | Regenerate OpenAPI artifact                                |
| `bun run docs:generate:routes`  | Regenerate route inventory                                 |
| `bun run docs:check`            | Verify documentation metadata and examples                 |
| `bun run docs:scalar:preview`   | Preview repo documentation through Scalar Docs             |
| `bun run cleanup:cv-uploads`    | Remove expired temporary CV uploads according to retention |

## Testing And Verification

Fast local verification:

```bash
bun run typecheck
bun run lint
bun run format:check
bun test
bun run docs:check
```

Database-backed tests require an isolated test database and `RUN_DATABASE_TESTS=true`. Do not point these tests at development, staging, or production data.

Documentation or route changes may also require:

```bash
bun run docs:generate:openapi
bun run docs:generate:routes
bun run docs:generate:sync-readiness
bun run docs:scalar:check-config
```

Migration-affecting changes should run:

```bash
bun run prisma:verify:migrations
```

## API Documentation

The backend exposes generated API documentation in two forms:

| Surface                  | Path                          |
| ------------------------ | ----------------------------- |
| Generated OpenAPI file   | `docs/generated/openapi.json` |
| Runtime OpenAPI endpoint | `/openapi.json`               |
| Runtime Scalar viewer    | `/docs/api`                   |
| Scalar Docs config       | `scalar.config.json`          |

Recommended local workflow:

1. Start the backend with `bun run dev`.
2. Open `http://localhost:3000/docs/api`.
3. Use `http://localhost:3000/openapi.json` when tooling needs the raw OpenAPI document.

When routes or contracts change, update the implementation, update relevant module docs, regenerate generated artifacts, and run docs verification before merging.

## Project Structure

```text
.
|-- prisma/
|   |-- migrations/
|   |-- schema.prisma
|   |-- seed-data.ts
|   `-- seed.ts
|-- src/
|   |-- app.ts
|   |-- server.ts
|   |-- config/
|   |-- core/
|   |-- modules/
|   `-- shared/
|-- tests/
|   |-- unit/
|   |-- integration/
|   |-- smoke/
|   `-- fixtures/
|-- docs/
|   |-- generated/
|   |-- modules/
|   `-- operations/
|-- docker-compose.yml
|-- Dockerfile
|-- package.json
`-- scalar.config.json
```

Feature modules live under `src/modules/<module>/` and generally follow this shape:

```text
<module>.route.ts
<module>.controller.ts
<module>.service.ts
<module>.repository.ts
<module>.schema.ts
<module>.types.ts
<module>.constants.ts
index.ts
```

Routes define the HTTP shape, controllers coordinate input/output, services own business rules, repositories own Prisma queries, and schemas own Zod validation.

## Deployment Notes

The repository includes Docker and Compose support for running the application container. The active Compose file runs the app only and expects PostgreSQL to be provided externally.

Deployment expectations:

- Build a reproducible image from committed source and `bun.lock`.
- Provide runtime secrets through environment variables or a deployment env file.
- Run Prisma migrations explicitly before serving production traffic.
- Keep upload storage outside the application artifact.
- Use `/health/live` for process liveness and `/health/ready` for dependency readiness.
- Keep staging and production databases, secrets, and CORS origins separate.

Compose commands:

```bash
bun run docker:compose:config
bun run docker:compose:pull
bun run docker:compose:up
bun run docker:compose:down
```

## Contribution Guide

Before changing behavior:

- Read the relevant module doc in `docs/modules/**`.
- Keep module boundaries aligned with `docs/project-structure.md`.
- Update tests with the smallest coverage that proves the changed behavior.
- Update generated OpenAPI and route inventory when route contracts change.
- Update environment examples and `docs/environment.md` when variables change.
- Update database docs and migration verification when Prisma schema changes.

Before opening a PR or handing off a change, run the relevant verification commands for the touched area and document any checks that require external credentials or a live database.
