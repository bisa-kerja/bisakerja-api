---
title: Backend API Database Design
description: PostgreSQL, Prisma, data ownership, entity relationships, migration policy, and persistence conventions for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/database.md
last_reviewed: 2026-04-29
---

# Backend API Database Design

PostgreSQL is the durable source of truth for Bisakerja application state and normalized job data. Prisma is the Backend API schema, migration, and query abstraction.

Operational note:

- Runtime environments are expected to use managed or otherwise externally hosted PostgreSQL through `DATABASE_URL`.
- If the provider exposes a pooled runtime URL and a separate direct host for migrations, configure the pooler in `DATABASE_URL` and the direct host in `DIRECT_DATABASE_URL`.
- Prisma CLI and seed scripts now require `DIRECT_DATABASE_URL` explicitly; they do not silently reuse `DATABASE_URL`.
- The deployment Compose file no longer provisions its own PostgreSQL container.

This document defines the initial database architecture for MVP documentation. It is intentionally implementation-ready, but the final `prisma/schema.prisma` must still be reviewed during schema implementation.

## Design Principles

- Keep Backend API-owned user state transactional, auditable, and protected by ownership checks.
- Keep normalized job records stable enough for search, filtering, detail pages, and Model API input preparation.
- Keep Scraper API ownership separate from Backend API workflows.
- Store Model API outputs as backend-owned snapshots only when needed for user history, repeat viewing, debugging, or product analytics.
- Do not make Model API the owner of transactional data.
- Do not expose raw external job source payloads through frontend-facing API contracts.
- Prefer explicit relations, unique constraints, and indexes over implicit application-only assumptions.

## Naming Conventions

Use one convention per layer:

| Layer             | Convention                            | Example                                                   |
| ----------------- | ------------------------------------- | --------------------------------------------------------- |
| Prisma model      | Singular PascalCase                   | `SourcePlatform`, `JobListing`, `ApplicationRecord`       |
| PostgreSQL table  | Plural snake_case through `@@map`     | `source_platforms`, `job_listings`, `application_records` |
| Prisma field      | camelCase                             | `sourcePlatformId`, `createdAt`, `updatedAt`              |
| PostgreSQL column | snake_case through `@map` when needed | `source_platform_id`, `created_at`, `updated_at`          |
| Prisma enum       | PascalCase singular                   | `ApplicationStatus`, `WorkType`                           |
| Enum value        | Uppercase snake case                  | `REMOTE`, `INTERVIEW`, `FRESH_GRADUATE`                   |
| Index name        | Explicit snake_case                   | `job_listings_source_external_id_idx`                     |

Canonical source naming:

- Domain term: source platform.
- Prisma model: `SourcePlatform`.
- PostgreSQL table: `source_platforms`.
- Relation field: `sourcePlatformId`.

## Ownership Boundaries

| Data area                   | Primary writer                                       | Primary reader                         | Backend responsibility                                              |
| --------------------------- | ---------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| User accounts               | Backend API                                          | Backend API                            | Own schema, writes, auth checks, and lifecycle                      |
| User profiles               | Backend API                                          | Backend API, Model API via Backend API | Own writes and prepare profile context for AI                       |
| User preferences            | Backend API                                          | Backend API, Model API via Backend API | Own active preference set and updates                               |
| Bookmarks                   | Backend API                                          | Backend API                            | Own user-job saved state                                            |
| Application tracker         | Backend API                                          | Backend API                            | Own application records and status changes                          |
| AI result snapshots         | Backend API                                          | Backend API                            | Own persisted fit, skill gap, and CV analysis snapshots when stored |
| Source platforms            | Scraper API for source catalog, Backend API for read | Backend API                            | Read normalized source metadata                                     |
| Companies                   | Scraper API for job source ingestion                 | Backend API                            | Read normalized company display data                                |
| Job listings                | Scraper API                                          | Backend API                            | Read normalized jobs for discovery and AI context                   |
| Job requirements and skills | Scraper API                                          | Backend API, Model API via Backend API | Read normalized requirements for filtering and AI payloads          |
| Ingestion metadata          | Scraper API                                          | Backend API optionally                 | Read freshness state when surfaced by API                           |

Backend API repositories must not write scraper-owned normalized job records unless a documented ingestion handoff or admin correction workflow is approved later.

## Entity Catalog

### Identity And Auth

| Entity                   | Purpose                                                    | Owner       |
| ------------------------ | ---------------------------------------------------------- | ----------- |
| `User`                   | Account identity and basic state                           | Backend API |
| `AuthCredential`         | Local auth credential and password hash metadata           | Backend API |
| `RefreshToken`           | Hashed opaque refresh credential and token-family metadata | Backend API |
| `EmailVerificationToken` | Email verification OTP or token state                      | Backend API |
| `PasswordResetToken`     | Password reset token state                                 | Backend API |

### Profile And Preferences

| Entity           | Purpose                                                   | Owner                                                  |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `UserProfile`    | User career profile and onboarding state                  | Backend API                                            |
| `UserExperience` | Work or project experience entries                        | Backend API                                            |
| `UserEducation`  | Education history                                         | Backend API                                            |
| `Skill`          | Shared skill vocabulary                                   | Backend API initially, possible shared taxonomy later  |
| `UserSkill`      | User-to-skill relation with optional proficiency metadata | Backend API                                            |
| `UserPreference` | Active career preferences and notification preference     | Backend API                                            |
| `TargetRole`     | Preferred target roles if roles are normalized separately | Backend API                                            |
| `Location`       | Province/city reference if normalized locally             | Backend API initially, possible shared reference later |

### Job Catalog

| Entity           | Purpose                                                       | Owner                           |
| ---------------- | ------------------------------------------------------------- | ------------------------------- |
| `SourcePlatform` | External source such as Glints, Jobstreet, Kalibrr, or Dealls | Scraper API integration concern |
| `Company`        | Normalized company display data                               | Scraper API                     |
| `JobListing`     | Normalized job opportunity                                    | Scraper API                     |
| `JobRequirement` | Structured requirement text and requirement category          | Scraper API                     |
| `JobSkill`       | Job-to-skill relation or normalized requirement skill         | Scraper API                     |
| `IngestionRun`   | Optional scraper run metadata and freshness state             | Scraper API                     |

### User Actions

| Entity                     | Purpose                                    | Owner       |
| -------------------------- | ------------------------------------------ | ----------- |
| `Bookmark`                 | User-saved job listing                     | Backend API |
| `ApplicationRecord`        | User-specific application tracker record   | Backend API |
| `ApplicationStatusHistory` | MVP audit trail for tracker status changes | Backend API |

### AI Outputs

| Entity             | Purpose                                                    | Owner                                   |
| ------------------ | ---------------------------------------------------------- | --------------------------------------- |
| `FitScoreResult`   | Persisted fit score and explanation snapshot               | Backend API stores, Model API generates |
| `SkillGapResult`   | Persisted skill gap snapshot                               | Backend API stores, Model API generates |
| `CvAnalysisResult` | Persisted CV analysis snapshot                             | Backend API stores, Model API generates |
| `AiRequestLog`     | Optional sanitized request/response metadata for debugging | Backend API                             |

## ERD-Level Relationships

```text
User
  -> UserProfile
  -> UserPreference
  -> UserSkill -> Skill
  -> UserExperience
  -> UserEducation
  -> Bookmark -> JobListing
  -> ApplicationRecord -> JobListing
  -> FitScoreResult -> JobListing
  -> SkillGapResult -> JobListing
  -> CvAnalysisResult -> JobListing

SourcePlatform
  -> JobListing

Company
  -> JobListing

JobListing
  -> JobRequirement
  -> JobSkill -> Skill
  -> Bookmark
  -> ApplicationRecord
  -> FitScoreResult
  -> SkillGapResult
  -> CvAnalysisResult

IngestionRun
  -> JobListing
```

Relationship rules:

- One `User` has one active `UserProfile`.
- One `User` has one active `UserPreference`.
- One `User` can have many `UserSkill`, `UserExperience`, and `UserEducation` records.
- One `SourcePlatform` can have many `JobListing` records.
- One `Company` can have many `JobListing` records.
- One `JobListing` can have many `JobRequirement` and `JobSkill` records.
- One `User` can bookmark many jobs; each `(userId, jobListingId)` pair must be unique.
- One `User` can track many applications; each active `(userId, jobListingId)` pair should be unique.
- One `ApplicationRecord` can have many status history records if status history is implemented.
- One `JobListing` can produce many user-specific AI result snapshots.

## Baseline Table Plan

| Prisma model               | Table                          | Owner                             | MVP need                            |
| -------------------------- | ------------------------------ | --------------------------------- | ----------------------------------- |
| `User`                     | `users`                        | Backend API                       | Auth and ownership                  |
| `AuthCredential`           | `auth_credentials`             | Backend API                       | Local login                         |
| `EmailVerificationToken`   | `email_verification_tokens`    | Backend API                       | Email verification                  |
| `PasswordResetToken`       | `password_reset_tokens`        | Backend API                       | Forgot/reset password               |
| `UserProfile`              | `user_profiles`                | Backend API                       | Onboarding and AI context           |
| `UserExperience`           | `user_experiences`             | Backend API                       | Profile and AI context              |
| `UserEducation`            | `user_educations`              | Backend API                       | Profile and AI context              |
| `Skill`                    | `skills`                       | Backend API initially             | User skills and job skills          |
| `UserSkill`                | `user_skills`                  | Backend API                       | Profile skill set                   |
| `UserPreference`           | `user_preferences`             | Backend API                       | Personalization                     |
| `SourcePlatform`           | `source_platforms`             | Scraper API                       | Job source metadata                 |
| `Company`                  | `companies`                    | Scraper API                       | Job display                         |
| `JobListing`               | `job_listings`                 | Scraper API                       | Search and detail                   |
| `JobRequirement`           | `job_requirements`             | Scraper API                       | Detail and model input              |
| `JobSkill`                 | `job_skills`                   | Scraper API                       | Filtering and model input           |
| `IngestionRun`             | `ingestion_runs`               | Scraper API                       | Freshness and debugging             |
| `Bookmark`                 | `bookmarks`                    | Backend API                       | Saved jobs                          |
| `ApplicationRecord`        | `application_records`          | Backend API                       | Tracker                             |
| `ApplicationStatusHistory` | `application_status_histories` | Backend API                       | MVP tracker audit trail             |
| `FitScoreResult`           | `fit_score_results`            | Backend API stores derived output | Job fit history if persisted        |
| `SkillGapResult`           | `skill_gap_results`            | Backend API stores derived output | Skill gap history if persisted      |
| `CvAnalysisResult`         | `cv_analysis_results`          | Backend API stores derived output | AI CV Analyzer history if persisted |
| `AiRequestLog`             | `ai_request_logs`              | Backend API                       | Sanitized debugging if needed       |

## MVP Module Persistence Map

| Module         | Persistence model                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Auth           | `User`, `AuthCredential`, `RefreshToken`, `EmailVerificationToken`, and `PasswordResetToken`                               |
| Users          | `User`, `UserProfile`, `UserExperience`, `UserEducation`, `UserSkill`, `Skill`                                             |
| Preferences    | `UserPreference`, optionally `TargetRole` and `Location` if normalized separately                                          |
| Jobs           | Read `SourcePlatform`, `Company`, `JobListing`, `JobRequirement`, `JobSkill`, `Skill`; do not write scraper-owned job rows |
| Bookmarks      | `Bookmark`, with read joins to `JobListing` and `Company`                                                                  |
| Applications   | `ApplicationRecord` and `ApplicationStatusHistory`                                                                         |
| AI Job Fit     | Read user/profile/preference/job context; optionally store `FitScoreResult` and `SkillGapResult` snapshots                 |
| AI CV Analyzer | Read selected job context; store uploaded CV metadata and optionally `CvAnalysisResult` snapshot                           |
| Health         | No business persistence; may check PostgreSQL connectivity                                                                 |

## ID Strategy

- Use UUID-compatible ids for application-owned records.
- Prefer database-generated ids through Prisma defaults.
- Keep external job ids separate from internal ids.
- Use composite uniqueness for source identity: `(sourcePlatformId, externalJobId)`.
- Do not use external source ids as primary keys.

Required external identity fields for job listings:

- `sourcePlatformId`
- `externalJobId`
- `sourceUrl`
- `sourcePostedAt` when available
- `sourceUpdatedAt` or source freshness equivalent when available

## Timestamp And Audit Fields

Default fields:

- `createdAt`
- `updatedAt`

Recommended optional fields by domain:

| Field             | Use                                                                |
| ----------------- | ------------------------------------------------------------------ |
| `deletedAt`       | Soft delete for user-owned records where recovery or audit matters |
| `lastSeenAt`      | Last observed time for scraper-owned job records                   |
| `expiredAt`       | Job expiration or token expiration                                 |
| `verifiedAt`      | Email verification state                                           |
| `appliedAt`       | Application tracker state                                          |
| `analyzedAt`      | AI result snapshot timestamp                                       |
| `createdByUserId` | Audit user-created records if needed                               |
| `updatedByUserId` | Audit sensitive user-owned changes if needed                       |

Soft delete policy:

- Use soft delete for user-owned records when user recovery, audit, or historical analysis matters.
- Avoid soft delete for short-lived tokens; expire and delete them instead.
- Job listings should prefer active/freshness status over hard delete so historical bookmarks and applications do not break.

## Index And Constraint Plan

### Users And Auth

- Unique `users.email`.
- Unique `users.username` only if username is user-facing and required.
- Unique `auth_credentials.userId`.
- Index token tables by token hash and expiration.
- Index `email_verification_tokens.userId`.
- Index `password_reset_tokens.userId`.

### Profiles And Preferences

- Unique active `user_profiles.userId` for MVP.
- Unique active `user_preferences.userId` for MVP.
- Unique `(userId, skillId)` on `user_skills`.
- Index skill name or slug for searchable skill selection.
- Index preference fields used for recommendation filtering when queries mature.

### Job Catalog

- Unique `(sourcePlatformId, externalJobId)` on `job_listings`.
- Index `job_listings.sourcePlatformId`.
- Index `job_listings.companyId`.
- Index job title or normalized role field.
- Index location fields such as province and city.
- Index work type, employment type, experience level, and posted date.
- Index salary min and salary max if salary filtering is supported.
- Index `lastSeenAt`, `expiredAt`, or status for freshness.
- Unique `(jobListingId, skillId)` on `job_skills` when skills are normalized.

### User Actions

- Unique `(userId, jobListingId)` on `bookmarks`.
- Unique active `(userId, jobListingId)` on `application_records`.
- Index `application_records.status`.
- Index `application_records.updatedAt`.
- Index `application_status_histories.applicationRecordId`.

### AI Results

- Index `(userId, jobListingId)` on `fit_score_results`.
- Index `(userId, jobListingId)` on `skill_gap_results`.
- Index `(userId, jobListingId)` on `cv_analysis_results` when tied to a job.
- Index `analyzedAt` for cleanup and history sorting.
- Avoid indexing large JSON payload fields unless a specific query requires it.

## Normalized Job Data

The Backend API must treat job data as normalized platform data. It should not depend on raw Glints, Jobstreet, Kalibrr, or Dealls payload shape.

Expected normalized job fields:

- Internal id.
- `sourcePlatformId`.
- `externalJobId`.
- Company relation.
- Title or role.
- Description.
- Requirement summary.
- Work type.
- Employment type.
- Experience level.
- Location text plus normalized province/city when available.
- Salary min, salary max, currency, and salary period when available.
- Source URL or external apply URL.
- Posted date from source when available.
- Last seen or freshness metadata.
- Active, stale, expired, or closed status.

Deduplication:

- Primary deduplication is `(sourcePlatformId, externalJobId)`.
- Cross-source duplicate detection is future scope unless scraper docs define it.
- Backend API should not merge cross-source duplicates on read unless a documented product rule exists.

Freshness:

- `lastSeenAt` tracks when scraper last observed the listing.
- `JOB_STALE_AFTER_HOURS` from environment docs defines when stale listings should be flagged.
- Stale jobs may remain visible if they still matter for bookmarks or application history.
- Expired or closed jobs should not disappear from user tracker history.

## User-Owned Transactional Data

User-owned records must always enforce user ownership in the service layer before read or mutation.

### Profiles

Profile data supports onboarding and AI context:

- Basic identity display fields.
- Career status: fresh graduate, early career, career switcher.
- Job seeking status: immediate, 1 month, 3 months.
- Profile photo metadata.
- Skills, experience, and education.

### Preferences

Preference data supports personalization:

- Target roles.
- Preferred locations.
- Work types.
- Salary range.
- Email notification preference.

The MVP should use one active preference set per user. Versioned preferences are future scope unless product analytics requires history.

### Bookmarks

Bookmarks represent saved jobs:

- Must be unique per user and job.
- Should not create duplicate rows for repeated save actions.
- Should keep references valid even if the job becomes stale or expired.

### Applications

Application records represent user tracker state:

- Must belong to one user and one job.
- Should store status, notes if implemented, and timestamps.
- Must validate status transitions in service logic.
- Should retain history when it improves auditability or user insight.

Baseline status values:

- `APPLIED`
- `INTERVIEW`
- `REJECTED`
- `ACCEPTED`

If the UI uses `DIPROSES`, map it deliberately to a canonical backend enum before implementation.

## AI Output Persistence

Model API outputs are derived data. Persist them only when persistence improves user experience or product learning.

Recommended persistence policy:

| Output                         | Persist?      | Reason                                                      |
| ------------------------------ | ------------- | ----------------------------------------------------------- |
| Fit score                      | Optional yes  | Useful for repeat viewing and history                       |
| Explanation breakdown          | Optional yes  | Helps user review decisions later                           |
| Skill gap result               | Optional yes  | Supports improvement plan history                           |
| Career strategy recommendation | Optional yes  | Useful as a snapshot tied to profile and job state          |
| CV analysis result             | Optional yes  | Useful for user review, but privacy-sensitive               |
| Raw model internals            | No            | Avoid leaking implementation detail and reduce privacy risk |
| Raw CV content                 | No by default | Store files only as needed with explicit retention          |

Snapshot rules:

- Store the model version or inference version when available.
- Store the user id and job id used for the result.
- Store sanitized input summary, not full sensitive payloads.
- Store created/analyzed timestamp.
- Do not let Model API write directly to database.

## Sensitive Data Handling

Sensitive data categories:

- Password hashes.
- Refresh tokens.
- Email verification OTPs.
- Password reset tokens.
- Uploaded CV files.
- CV extracted text or analysis input.
- Service-to-service credentials.

Rules:

- Store password hashes only, never plaintext passwords.
- Store token hashes instead of raw token values when tokens must be persisted.
- Expire verification and reset tokens.
- Delete or invalidate used verification and reset tokens.
- Do not log passwords, tokens, OTP values, service credentials, raw CV content, or full AI payloads.
- Keep CV upload metadata separate from raw file content.
- Apply `CV_RETENTION_DAYS` from environment documentation.
- Use local temporary storage for MVP CV uploads and document any object storage migration before implementation.

Suggested CV metadata fields:

- `userId`
- `originalFileName`
- `mimeType`
- `sizeBytes`
- `storageDriver`
- `storageKey`
- `uploadedAt`
- `expiresAt`
- `deletedAt`

## Prisma Schema Conventions

### Model Naming

- Use singular PascalCase model names.
- Map to plural snake_case table names with `@@map`.
- Use explicit relation names only when Prisma requires them for clarity.

Example convention:

```prisma
model JobListing {
  id               String         @id @default(uuid())
  sourcePlatformId String         @map("source_platform_id")
  externalJobId    String         @map("external_job_id")
  title            String
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  sourcePlatform   SourcePlatform @relation(fields: [sourcePlatformId], references: [id])

  @@unique([sourcePlatformId, externalJobId], map: "job_listings_source_external_id_unique")
  @@map("job_listings")
}
```

### Enum Naming

- Use PascalCase enum names.
- Use uppercase snake case enum values.
- Keep UI labels outside the database enum where possible.

Examples:

- `ApplicationStatus`: `APPLIED`, `INTERVIEW`, `REJECTED`, `ACCEPTED`.
- `WorkType`: `REMOTE`, `HYBRID`, `ONSITE`.
- `CareerStatus`: `FRESH_GRADUATE`, `EARLY_CAREER`, `CAREER_SWITCHER`.

### Relation Naming

- Use descriptive relation fields: `user`, `jobListing`, `sourcePlatform`, `company`.
- Relation id fields should end with `Id`: `userId`, `jobListingId`, `companyId`.
- Do not expose database relation internals directly in API responses.

### JSON Fields

Use JSON only when shape is either:

- Truly model-output-like and versioned.
- Temporary while upstream shape is not stable.
- Rarely queried and not needed for relational filtering.

Avoid JSON for fields that need filters, sorting, joins, or integrity constraints.

### Generated Client Usage

- Use the generated Prisma client at `src/generated/prisma`.
- Use a single Prisma client instance exported from `src/shared/libs/prisma.ts`.
- Repositories should receive or import the Prisma client consistently.
- Controllers should never import Prisma directly.
- Services should use repositories instead of direct Prisma access except for carefully documented transactions.

The project uses Prisma ORM 7 configuration:

- `prisma.config.ts` defines the schema path, migrations path, seed command, and datasource URL.
- `prisma/schema.prisma` uses the `prisma-client` generator with an explicit output path.
- Runtime code imports `PrismaClient` from `src/generated/prisma/client`.
- The PostgreSQL adapter is configured in the shared Prisma wrapper.

Generated client files are build artifacts and must be regenerated after schema changes.

## Migration Policy

Migration rules:

- Every schema change must create a Prisma migration.
- Migration names must describe intent, such as `add_application_tracker_tables`.
- Do not edit applied production migrations.
- Prefer additive migrations during active development when possible.
- Destructive changes require explicit data migration notes and rollback consideration.
- Keep schema changes and docs changes aligned in the same work item when behavior changes.

Required migration review:

- New tables include ownership and lifecycle fields.
- Required indexes exist for planned filters and joins.
- Unique constraints match business rules.
- Sensitive fields are hashed, tokenized, or redacted as appropriate.
- Backfill or data cleanup steps are documented when needed.

## Seed Strategy

Seed data should support local development and integration tests without leaking production data.

Allowed seed data:

- Source platforms: Glints, Jobstreet, Kalibrr, Dealls.
- Sample companies.
- Sample job listings.
- Sample skills and job skills.
- Test users with clearly fake emails.
- Sample preferences, bookmarks, and application records.
- Sanitized AI result snapshots, CV metadata, and request logs for development-only flows.

Seed rules:

- Keep seeds deterministic.
- Do not include real user data.
- Do not include real secrets.
- Use separate test fixtures for integration tests when possible.
- Document seed commands after project setup defines package scripts.

The seed script lives at `prisma/seed.ts` and creates deterministic normalized data for local development:

- Five source platforms, nine companies, and five ingestion runs.
- Eight user accounts with auth credentials, refresh tokens, verification tokens, and password reset tokens.
- Eight user profiles, eight preference records, and realistic profile history through experience, education, and user skills.
- Ten product-shaped job listings with normalized requirements and job-skill links across active, stale, expired, and closed states.
- User activity data through bookmarks, application tracker records, and status histories with more varied lifecycle coverage.
- Development-only AI artifacts through fit score snapshots, skill gap snapshots, CV file metadata, CV analysis results, and AI request logs.

Current seeded local accounts:

| User            | Email                          | Primary focus                  |
| --------------- | ------------------------------ | ------------------------------ |
| Annisa Pratama  | `annisa.pratama@example.test`  | Backend / platform engineering |
| Bima Saputra    | `bima.saputra@example.test`    | Full stack engineering         |
| Citra Lestari   | `citra.lestari@example.test`   | Data analysis                  |
| Dion Wijaya     | `dion.wijaya@example.test`     | Product / operations           |
| Eka Novita      | `eka.novita@example.test`      | Product design                 |
| Farah Maharani  | `farah.maharani@example.test`  | Product design / discovery     |
| Gilang Ramadhan | `gilang.ramadhan@example.test` | QA automation / API quality    |
| Hana Putri      | `hana.putri@example.test`      | Data operations (deleted seed) |

Run locally:

1. Apply migrations with `bun run prisma:migrate:deploy` or `bun run prisma:migrate:dev`.
2. Run `bun run prisma:seed`.
3. Set `SEED_USER_PASSWORD` explicitly before seeding. The repository no longer provides a hidden default seed password.

Seed expectations:

- Every Prisma-backed table currently in `prisma/schema.prisma` receives at least five deterministic records.
- Seed values are synthetic but product-shaped, so list, detail, bookmark, application, and AI-history screens can be exercised immediately.
- Re-running the seed replaces the same deterministic records instead of creating unbounded duplicates.

Seed data must stay product-shaped but synthetic. It must not include raw external provider payloads, real user records, raw CV content, raw model payloads, production credentials, tokens, OTP values, or service credentials. Seed login credentials must come from explicit environment configuration so misconfigured local or test setups fail immediately.

## Data Retention

Initial retention direction:

| Data                      | Retention direction                                           |
| ------------------------- | ------------------------------------------------------------- |
| User account              | Keep until account deletion policy is defined                 |
| Profile and preferences   | Keep while account is active                                  |
| Bookmarks                 | Keep while account is active or until user removes them       |
| Application tracker       | Keep while account is active unless user deletes record       |
| Password reset tokens     | Delete or expire quickly after use                            |
| Email verification tokens | Delete or expire quickly after use                            |
| CV uploaded files         | Follow `CV_RETENTION_DAYS`; default 1 day in environment docs |
| CV analysis result        | Persist only when `persistResult=true`; redact raw content    |
| AI request logs           | Keep short-lived and sanitized                                |
| Job listings              | Keep stale/expired records when linked to user history        |

## Deferred Decisions Before Schema Implementation

- Whether `Location` and `TargetRole` become normalized tables in MVP or remain preference fields.
- Whether skill taxonomy is locally owned or imported from shared ID-TechSkill taxonomy.
- Whether `IngestionRun` is represented in this repo's Prisma schema or owned entirely by Scraper API docs.
- Final cleanup command or worker shape for expired temporary CV files.
- Generated OpenAPI schema source and relation to Zod schemas.

## Related Docs

- `docs/overview.md`
- `docs/architecture.md`
- `docs/project-structure.md`
- `docs/environment.md`
- `references/docs/overview/database-overview.mdx`
- `references/docs/references/domain-entities.mdx`
- `references/docs/overview/data-flow.mdx`
