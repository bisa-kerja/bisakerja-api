---
title: Backend API Overview
description: Service purpose, MVP scope, ownership boundaries, and documentation rules for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/overview.md
last_reviewed: 2026-04-22
---

# Backend API Overview

The Bisakerja Backend API is the main application backend for Bisakerja. It owns user-facing application workflows, authentication, authorization, request validation, business rules, persistence orchestration, and the API contract consumed by the Frontend UI.

Bisakerja is an AI-assisted career decision platform for Indonesian job seekers. The product exists to help users find relevant jobs, understand their fit for a role, identify skill gaps, improve CV quality, and track application outcomes with less trial and error.

## Purpose

This service must provide a stable backend boundary for:

- Anonymous job discovery.
- Authenticated profile, preference, bookmark, and application tracker workflows.
- AI-assisted job fit, skill gap, and CV analysis workflows.
- Normalized job catalog access backed by PostgreSQL.
- Internal orchestration with Scraper API and Model API without exposing those services directly to the frontend.

The Backend API should not behave as a generic proxy. It should shape backend responses around product workflows, validate all user input, enforce ownership rules, and translate downstream failures into frontend-safe API responses.

## Primary Users

Product users:

- Fresh graduates entering digital or technology roles.
- Early-career professionals with roughly 0 to 3 years of experience.
- Career switchers moving into digital or technology roles.

Technical consumers:

- Frontend UI, as the only public application consumer.
- Model API, as an internal dependency called by the backend for AI output.
- PostgreSQL, as the primary persistence layer.
- Scraper API and scraper-managed data, as the upstream source of normalized job inventory.

## MVP Scope

| Module         | MVP responsibility                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | Register, login, logout, short-lived access JWT, hashed refresh token cookie with rotation, password reset, OTP email verification, and Google SSO placeholder  |
| Users          | Account profile, onboarding state, profile photo metadata, career background, skills, experience, and education                                                 |
| Preferences    | Career status, job seeking timeline, target roles, preferred locations, work types, salary range, and email notification preference                             |
| Jobs           | Search, filter, sort, list, detail, normalized company data, job requirements, salary data, and external apply link                                             |
| Bookmarks      | Save job, remove saved job, list saved jobs, and duplicate conflict handling                                                                                    |
| Applications   | Track user-specific job application state and MVP status history                                                                                                |
| AI Job Fit     | Prepare backend-owned inference payloads and return fit score, explanation, skill gap, and recommended next steps                                               |
| AI CV Analyzer | Accept temporary PDF upload input, compare against a selected job, and return CV quality, job alignment, ATS, keyword, quantification, and improvement feedback |

## Future Scope

The following capabilities are documented as future scope and must not block MVP implementation:

- Mentoring onboarding, mentor profiles, availability, and mentor search.
- Notification delivery expansion beyond the MVP email preference toggle and auth email flows.
- Product analytics, application intelligence dashboards, and general analytics event pipelines.
- Payment, subscription, or premium capability.
- Direct ATS integration or auto-apply to external platforms.
- Native mobile applications.

## Service Boundary

The Backend API owns:

- Authentication and authorization decisions.
- User profile, preference, bookmark, and application tracker workflows.
- Backend-facing request validation with Zod.
- API response formatting and error mapping.
- Prisma-based database access for backend-owned records.
- Product-friendly formatting of Model API outputs.
- Read access to normalized job records required by search, detail, and AI workflows.

The Backend API does not own:

- Frontend rendering or client-side state.
- Scraping, parsing, and normalization logic for external job platforms.
- Model training, model artifact management, or low-level inference internals.
- Central Bisakerja Docs platform governance.

## Runtime Topology

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

The frontend must call the Backend API for all user-facing application workflows. It must not call Scraper API or Model API directly.

## Job Source Strategy

The product and platform references name four target job sources:

- Glints
- Jobstreet
- Kalibrr
- Dealls

The domain model must support all four sources through a normalized `source_platform` concept. Implementation may prioritize the first 1 to 2 sources during early milestones, but API contracts should not assume a single provider.

## Documentation Source Of Truth

Use these local references when writing or changing backend docs:

| Source                      | Purpose                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `bisakerja-product-idea.md` | Product vision, user problem, MVP features, and value proposition                                          |
| `bisakerja-feature-flow.md` | User journeys, onboarding flow, job discovery, tracker, AI CV Analyzer, and future Mentoring flow          |
| `bisakerja-project-plan.md` | Capstone scope, service responsibilities, integration direction, milestone plan, and team responsibilities |
| `docs/project-structure.md` | Current backend folder structure, module organization, and dependency boundaries                           |
| `references/docs/**`        | Platform architecture, service boundaries, metadata, sync, review, freshness, and documentation standards  |

## Documentation Sync

This repo owns backend service documentation under `docs/**`. The central Bisakerja Docs repository is expected to import service-owned pages into:

```text
docs/services/backend-api/synced/**
```

Every synchronized page must preserve:

- `source_repo: backend-api`
- `source_path`
- `owner`
- `reviewers`
- `doc_status`
- `last_reviewed`

Central docs should summarize and route readers across the platform. Service docs should contain backend-specific technical decisions and implementation guidance.

## Documentation Metadata Rules

Every maintained backend documentation page must include this frontmatter shape:

```md
---
title: Page Title
description: One-sentence summary for readers and search.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/example.md
last_reviewed: 2026-04-22
---
```

Rules:

- Use `draft` until the page has been reviewed for implementation readiness.
- Use `active` only after the documented behavior matches implemented behavior.
- Keep `source_path` equal to the path in this repository.
- Update `last_reviewed` after meaningful review.
- Add module owners later if ownership becomes more specific than `backend-owner`.

## Related Docs

- `docs/tech-stack.md`
- `docs/environment.md`
- `references/docs/services/backend-api/index.mdx`
- `references/docs/overview/system-architecture.mdx`
- `references/docs/overview/database-overview.mdx`
