---
title: Backend API Project Structure
description: Folder layout, module anatomy, naming conventions, dependency direction, and import boundaries for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/project-structure.md
last_reviewed: 2026-04-22
---

# Backend API Project Structure

The Bisakerja Backend API should use a feature-based module structure. Each product capability lives under `src/modules/<module>/`, while global runtime setup, cross-cutting middleware, shared utilities, Prisma, and tests stay outside feature modules.

This structure refines `folder-structur-reference.md` by making module file names consistent with the module directory name.

## Target Layout

```text
.
|-- prisma/
|   |-- migrations/
|   |-- schema.prisma
|   `-- seed.ts
|
|-- src/
|   |-- app.ts
|   |-- server.ts
|   |
|   |-- config/
|   |   |-- env.ts
|   |   |-- database.ts
|   |   `-- logger.ts
|   |
|   |-- core/
|   |   |-- constants/
|   |   |   `-- index.ts
|   |   |-- errors/
|   |   |   |-- app.error.ts
|   |   |   `-- error.handler.ts
|   |   |-- middlewares/
|   |   |   |-- auth.middleware.ts
|   |   |   |-- rate-limit.middleware.ts
|   |   |   |-- request-id.middleware.ts
|   |   |   `-- validate.middleware.ts
|   |   `-- responses/
|   |       `-- response.formatter.ts
|   |
|   |-- modules/
|   |   |-- auth/
|   |   |-- users/
|   |   |-- preferences/
|   |   |-- jobs/
|   |   |-- bookmarks/
|   |   |-- applications/
|   |   |-- ai-job-fit/
|   |   |-- ai-cv-analyzer/
|   |   |-- health/
|   |   `-- index.ts
|   |
|   `-- shared/
|       |-- integrations/
|       |   `-- model-api.client.ts
|       |-- libs/
|       |   `-- prisma.ts
|       |-- types/
|       |   `-- global.d.ts
|       `-- utils/
|           |-- hash.ts
|           |-- jwt.ts
|           `-- pagination.ts
|
|-- tests/
|   |-- unit/
|   |-- integration/
|   `-- fixtures/
|
|-- docs/
|-- .env.example
|-- package.json
`-- tsconfig.json
```

## Directory Responsibilities

| Path            | Responsibility                                                                               |
| --------------- | -------------------------------------------------------------------------------------------- |
| `prisma/`       | Prisma schema, migrations, and seed data                                                     |
| `src/app.ts`    | Express app creation, global middleware, route registration, and error handler registration  |
| `src/server.ts` | Runtime bootstrap, port binding, startup logging, and graceful shutdown                      |
| `src/config/`   | Environment validation, logger configuration, and database client setup                      |
| `src/core/`     | Global framework-level concerns that are not domain-specific                                 |
| `src/modules/`  | Feature modules and their routes, controllers, services, repositories, schemas, and types    |
| `src/shared/`   | Reusable utilities, integration clients, shared types, and wrappers used by multiple modules |
| `tests/`        | Unit, integration, route, contract, and fixture test support                                 |
| `docs/`         | Service-owned technical documentation synced later to Bisakerja Docs                         |

## Module Anatomy

Every feature module should use this default shape:

```text
src/modules/<module>/
  <module>.route.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts
  <module>.schema.ts
  <module>.types.ts
  <module>.constants.ts
  index.ts
```

File responsibilities:

| File                     | Responsibility                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `<module>.route.ts`      | Express route definitions and middleware sequence                                                     |
| `<module>.controller.ts` | HTTP input/output coordination and service calls                                                      |
| `<module>.service.ts`    | Business rules, orchestration, authorization checks that need domain data, and transaction boundaries |
| `<module>.repository.ts` | Prisma queries for the module's data access                                                           |
| `<module>.schema.ts`     | Zod schemas for params, query, body, and internal payloads                                            |
| `<module>.types.ts`      | Module-specific TypeScript types that are not derived from Prisma or Zod                              |
| `<module>.constants.ts`  | Module-specific constants, enums, and code lists when needed                                          |
| `index.ts`               | Module exports for route registration and tests                                                       |

Small modules may omit `repository`, `constants`, or `types` only when there is no database access, no constants, or no local types. Do not omit route, controller, service, or schema files for MVP modules unless the module is intentionally documentation-only.

## MVP Modules

| Module directory  | Purpose                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`           | Register, login, logout/session invalidation, token/session refresh, password reset, email verification, and Google SSO placeholder |
| `users/`          | Profile, onboarding state, career background, skills, experience, education, and account settings                                   |
| `preferences/`    | Career status, job seeking timeline, target roles, locations, work types, salary range, and email notification preference           |
| `jobs/`           | Search, filter, sort, list, detail, company data, job requirements, source metadata, and external apply link                        |
| `bookmarks/`      | Save job, remove saved job, list saved jobs, duplicate handling, and ownership checks                                               |
| `applications/`   | Application tracker records, status changes, notes, and ownership checks                                                            |
| `ai-job-fit/`     | Fit score, explanation breakdown, skill gap, readiness, and recommendation output                                                   |
| `ai-cv-analyzer/` | CV upload analysis, job comparison, ATS score, keyword optimization, quantification, and improvements                               |
| `health/`         | Liveness and readiness endpoints                                                                                                    |

Future modules such as `mentoring/`, `notifications/`, and `analytics/` should not be added until their documentation and scope are approved.

## Dependency Direction

Allowed dependency direction:

```text
route
  -> middleware
  -> controller
  -> service
  -> repository
  -> prisma

service
  -> integration client
  -> downstream service
```

Rules:

- Routes can import middleware, schemas, and controllers.
- Controllers can import schemas, services, response helpers, and request types.
- Services can import repositories, integration clients, domain constants, and shared utilities.
- Repositories can import Prisma client, Prisma types, and module data-mapping helpers.
- Integration clients can import config, logger, validation schemas, and HTTP helpers.
- `app.ts` imports module routes through `src/modules/index.ts`.

Forbidden dependency direction:

- Repository importing controller or Express request/response objects.
- Service importing Express response objects.
- Controller importing Prisma directly.
- Module importing another module's repository directly.
- Frontend response formatting inside repositories.
- Zod request validation inside repositories.

If a module needs behavior from another module, expose a service-level method or create a small shared utility only when it is truly cross-module.

## Import Boundaries

Recommended import aliases after TypeScript setup:

| Alias         | Target          | Usage                                                      |
| ------------- | --------------- | ---------------------------------------------------------- |
| `@/config/*`  | `src/config/*`  | Runtime configuration                                      |
| `@/core/*`    | `src/core/*`    | Global middleware, errors, constants, and response helpers |
| `@/modules/*` | `src/modules/*` | Feature modules                                            |
| `@/shared/*`  | `src/shared/*`  | Shared utilities, integration clients, libs, and types     |

Rules:

- Use aliases for cross-directory imports after `tsconfig` paths are configured.
- Use relative imports inside the same module when files are nearby.
- Do not import from deep private files of another module unless that module explicitly exports them from `index.ts`.
- Avoid circular module dependencies. Move shared value objects or helper functions to `src/shared/` only when at least two modules need them.

## Naming Conventions

| Item                  | Convention                                 | Example                                     |
| --------------------- | ------------------------------------------ | ------------------------------------------- |
| Directories           | lowercase kebab-case or plural domain noun | `ai-cv-analyzer`, `applications`            |
| Module files          | `<module>.<role>.ts`                       | `applications.service.ts`                   |
| Zod schemas           | `<Action><Target>Schema`                   | `CreateApplicationSchema`                   |
| Controller methods    | verb-object                                | `createApplication`, `listJobs`             |
| Service methods       | product action names                       | `analyzeJobFit`, `updateApplicationStatus`  |
| Repository methods    | persistence action names                   | `findById`, `createForUser`, `updateStatus` |
| Error codes           | uppercase snake case                       | `APPLICATION_NOT_FOUND`                     |
| Environment variables | uppercase snake case                       | `MODEL_API_BASE_URL`                        |
| Route params          | camelCase                                  | `jobId`, `applicationId`                    |

Module names:

- Use plural nouns for resource modules: `users`, `jobs`, `bookmarks`, `applications`, `preferences`.
- Use capability names for AI modules: `ai-job-fit`, `ai-cv-analyzer`.
- Use singular technical module names when they are not resource collections: `auth`, `health`.

## Route Registration

`src/modules/index.ts` should be the single module route registry.

Expected pattern:

```text
src/app.ts
  -> src/modules/index.ts
      -> auth/auth.route.ts
      -> users/users.route.ts
      -> preferences/preferences.route.ts
      -> jobs/jobs.route.ts
      -> bookmarks/bookmarks.route.ts
      -> applications/applications.route.ts
      -> ai-job-fit/ai-job-fit.route.ts
      -> ai-cv-analyzer/ai-cv-analyzer.route.ts
      -> health/health.route.ts
```

Route prefixes should be documented in module docs and mounted under the configured `API_PREFIX`, defaulting to `/api/v1`.

## Configuration Layer

`src/config/env.ts`:

- Defines Zod environment schema.
- Exports typed config.
- Fails fast during startup when required values are missing.

`src/config/database.ts`:

- Configures Prisma connection behavior if needed.
- Should not contain domain queries.

`src/config/logger.ts`:

- Configures structured logger.
- Sets redaction policy.
- Reads log level from validated environment config.

## Core Layer

`src/core/` is for global behavior:

- Application error classes.
- Central error handler.
- Validation middleware.
- Auth middleware.
- Rate limit middleware.
- Request id middleware.
- Response formatter.
- Global constants.

Do not put domain-specific rules in `src/core/`. If a rule references jobs, applications, CV analysis, or user preferences, it belongs in the relevant module.

## Shared Layer

`src/shared/` is for reusable implementation pieces:

- Prisma export wrapper.
- Model API client.
- Hashing helper.
- Token helper after auth strategy is approved.
- Pagination helper.
- Shared TypeScript declarations.

Shared code must remain boring and generic. Do not move code into `shared` just to avoid one import. Use it when the same behavior is genuinely used by more than one module.

## Tests Structure

Initial test layout:

```text
tests/
  unit/
    modules/
    core/
    shared/
  integration/
    routes/
    repositories/
    integrations/
  fixtures/
```

Test mapping:

| Test type              | Target                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| Unit                   | Pure services, validators, response formatters, and helpers             |
| Route integration      | Express routes, middleware order, auth behavior, and response envelopes |
| Repository integration | Prisma queries against an isolated test database                        |
| Integration contract   | Model API and Scraper API assumptions                                   |
| Smoke                  | Startup config, health endpoints, and database connectivity             |

## New Module Scaffold Checklist

Before implementing a new module:

- [ ] Confirm the module is in MVP scope or approved future scope.
- [ ] Create the module documentation page under `docs/modules/`.
- [ ] Define route prefix and auth requirement.
- [ ] Define Zod request schemas.
- [ ] Define response examples using the API response standard.
- [ ] Identify database models and ownership.
- [ ] Identify integration dependencies.
- [ ] Create route, controller, service, repository, schema, and type files as needed.
- [ ] Add module route registration to `src/modules/index.ts`.
- [ ] Add unit, route, and repository tests according to module risk.

## Related Docs

- `docs/architecture.md`
- `docs/overview.md`
- `docs/tech-stack.md`
- `docs/environment.md`
- `folder-structur-reference.md`
