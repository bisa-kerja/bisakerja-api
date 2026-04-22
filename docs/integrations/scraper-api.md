---
title: Scraper API Integration
description: Normalized job ingestion, PostgreSQL write ownership, freshness, backend read assumptions, and failure handling for Scraper API integration.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/integrations/scraper-api.md
last_reviewed: 2026-04-22
---

# Scraper API Integration

The Scraper API is the upstream ingestion service for Bisakerja job catalog data. It fetches jobs from external platforms, validates and normalizes source data, and writes normalized job records into PostgreSQL for Backend API consumption.

The Backend API reads normalized job data. It must not depend on raw source payloads or live scraper availability during user-facing search and job detail requests.

## Integration Boundary

| Area                                                        | Owner       |
| ----------------------------------------------------------- | ----------- |
| External source fetching                                    | Scraper API |
| Raw source payload handling                                 | Scraper API |
| Normalization and validation of source fields               | Scraper API |
| Normalized job write/upsert                                 | Scraper API |
| Job search, detail, bookmark, tracker, and AI context reads | Backend API |
| User-facing response shape                                  | Backend API |

Backend API must treat Scraper API as an upstream data supplier, not as a request-time dependency for search.

## Data Flow

```text
Scheduler
  -> Scraper API
      -> External Job Platforms
      -> raw source payloads
      -> normalization and validation
      -> PostgreSQL upsert
          -> Backend API reads normalized records
              -> Frontend UI
```

Rules:

- Search and detail endpoints read PostgreSQL, not Scraper API directly.
- Backend API can expose freshness metadata only after it is normalized.
- Backend API should remain available for existing job data even when scraping is delayed.
- Backend API should not surface parser-specific errors to users.

## Normalized Data Contract

The scraper-owned normalized job record must provide fields sufficient for:

- Job cards.
- Job detail.
- Filters and sorting.
- Bookmark lists.
- Application tracker job references.
- AI job fit and CV analyzer context.

Expected normalized fields:

| Field              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `id`               | Internal job id used by Backend API                          |
| `sourcePlatformId` | Source platform relation                                     |
| `externalJobId`    | Source-specific job id for deduplication                     |
| `companyId`        | Normalized company relation                                  |
| `title`            | Job title or role                                            |
| `description`      | Job description text                                         |
| `requirements`     | Structured requirement rows or normalized requirement text   |
| `skills`           | Normalized skill names or relations                          |
| `workType`         | `REMOTE`, `HYBRID`, or `ONSITE` when known                   |
| `employmentType`   | Full-time, internship, contract, or equivalent               |
| `experienceLevel`  | Entry, junior, mid, senior, or equivalent                    |
| `location`         | Display location and normalized province/city when available |
| `salary`           | Normalized min, max, currency, period, and display data      |
| `externalApplyUrl` | Link to source platform apply page                           |
| `postedAt`         | Source posted date when available                            |
| `lastSeenAt`       | Last time scraper observed the listing                       |
| `status`           | Active, stale, expired, closed, or equivalent                |

Backend API must not require source-specific fields that only exist for one platform.

## PostgreSQL Ownership

Scraper API-owned tables or data areas:

- `source_platforms`
- `companies`
- `job_listings`
- `job_requirements`
- `job_skills`
- `ingestion_runs` if represented in the shared schema
- Source freshness metadata

Backend API read usage:

- Read normalized jobs for `GET /api/v1/jobs`.
- Read job detail for `GET /api/v1/jobs/:jobId`.
- Join jobs into bookmark and application tracker lists.
- Load job context for AI Job Fit and AI CV Analyzer.

Write rule:

- Backend API must not write scraper-owned job rows in MVP.
- Admin correction or manual override workflows require separate documentation and authorization.

## Upsert And Deduplication

Primary deduplication key:

```text
(sourcePlatformId, externalJobId)
```

Rules:

- Scraper API should upsert by source platform and external job id.
- Cross-source duplicate detection is future scope unless Scraper API defines it.
- Backend API must not merge cross-source duplicates at read time without documented product rules.
- Expired or stale records should remain available when linked to bookmarks or applications.

## Refresh Cadence

The exact cadence is owned by Scraper API operations, but Backend API docs assume:

- Ingestion runs on a recurring schedule.
- Jobs can become stale if `lastSeenAt` exceeds `JOB_STALE_AFTER_HOURS`.
- `JOB_STALE_AFTER_HOURS` defaults to 72 hours in environment docs.
- Backend API can show stale indicators when freshness metadata exists.

Recommended metadata:

| Field             | Use                                                |
| ----------------- | -------------------------------------------------- |
| `lastSeenAt`      | Stale calculation                                  |
| `sourcePostedAt`  | Newest sort when source provides it                |
| `sourceUpdatedAt` | Source freshness and update tracking               |
| `ingestionRunId`  | Debugging scraper run that last touched the record |
| `status`          | Active, stale, expired, or closed                  |

## Backend Read Assumptions

The Backend API assumes:

- Normalized job rows are safe to display after backend response shaping.
- Required relation ids are valid or gracefully nullable.
- Salary fields are normalized enough for filtering or marked unknown.
- Location fields may be partial.
- Company logo and website are optional.
- Job requirements may be incomplete but should be safe text.
- External apply URL may become invalid after ingestion.

When normalized fields are missing, Backend API should degrade gracefully rather than expose raw payloads.

## Failure Scenarios

### Stale Job Data

Symptoms:

- Search technically works.
- Users see old or missing listings.
- `lastSeenAt` is older than expected.

Backend behavior:

- Continue serving available normalized jobs.
- Include `isStale` when supported by response contract.
- Do not call Scraper API synchronously to repair user requests.
- Log freshness context for debugging.

First checks:

- Confirm ingestion scheduler is running.
- Confirm recent `ingestion_runs` exist.
- Confirm `lastSeenAt` is updating.
- Confirm external source connectors have not drifted.

### Malformed Normalized Data

Symptoms:

- Missing title, company, salary, location, or requirements.
- Filters return unexpected results.
- AI payload preparation fails because job context is incomplete.

Backend behavior:

- Validate critical fields before response mapping.
- Return safe partial fields where product allows.
- Return `502 DOWNSTREAM_ERROR` or `503 SERVICE_UNAVAILABLE` only when malformed data blocks the workflow.
- Do not expose raw scraper payloads.

First checks:

- Inspect scraper normalization rules.
- Inspect recent source platform changes.
- Validate affected job rows.
- Compare normalized rows across sources.

### Source Throttling Or Source Unavailable

Symptoms:

- No new jobs from one platform.
- Ingestion logs show rate limits or blocked requests.

Backend behavior:

- Existing data remains available.
- Search should not fail solely because one source is unavailable.
- Source freshness may degrade for affected platform.

First checks:

- Identify affected `sourcePlatform`.
- Check scrape run errors.
- Check source-specific throttling or layout changes.

### PostgreSQL Connectivity Issue

Symptoms:

- Search, detail, bookmarks, applications, and AI context loading fail together.

Backend behavior:

- Return `503 SERVICE_UNAVAILABLE`.
- Mark readiness degraded.
- Log database dependency failure with request id.

First checks:

- Confirm database connection.
- Confirm Prisma connectivity.
- Confirm recent migrations or deployment changes.

## Observability

Backend API should log:

- `scraper_data.stale_detected`
- `scraper_data.malformed_record_detected`
- `jobs.search_used_stale_data`
- `jobs.detail_missing_normalized_field`

Recommended log fields:

- `requestId`
- `jobId`
- `sourcePlatform`
- `lastSeenAt`
- `isStale`
- `missingFields`
- result

Do not log raw source payloads by default.

## Test Scenarios

Integration tests:

- Search returns normalized jobs without contacting Scraper API.
- Job detail hides raw source payload fields.
- Stale job rows map to `isStale`.
- Missing optional company logo does not fail job response.
- Missing required job id returns `404`.
- Database unavailable maps to `503`.

Contract tests:

- Backend read expectations match normalized job schema.
- Source platform slugs include `glints`, `jobstreet`, `kalibrr`, and `dealls`.
- AI modules can build payloads from normalized job records.

## Related Docs

- `docs/integrations/job-sources.md`
- `docs/integrations/model-api.md`
- `docs/modules/jobs.md`
- `docs/modules/bookmarks.md`
- `docs/modules/applications.md`
- `docs/modules/ai-job-fit.md`
- `docs/modules/ai-cv-analyzer.md`
- `docs/database.md`
- `references/docs/overview/asynchronous-workflows.mdx`
- `references/docs/operations/failure-scenarios.mdx`
