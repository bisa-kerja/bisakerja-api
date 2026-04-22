---
title: Job Sources Integration
description: Glints, Jobstreet, Kalibrr, and Dealls source strategy, source priority, normalization expectations, risks, and frontend contract boundaries.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/integrations/job-sources.md
last_reviewed: 2026-04-22
---

# Job Sources Integration

Bisakerja targets four external job sources for normalized job ingestion:

- Glints
- Jobstreet
- Kalibrr
- Dealls

The Scraper API owns source-specific fetching and normalization. The Backend API owns product-safe read contracts over normalized job records.

## Source Strategy

The domain model must support all four sources from the start through `SourcePlatform` and `(sourcePlatformId, externalJobId)` identity.

Implementation may prioritize the first 1 to 2 sources while keeping the normalized contract source-agnostic.

Recommended source priority:

| Priority                    | Source    | Reason                                                         |
| --------------------------- | --------- | -------------------------------------------------------------- |
| Initial ingestion           | Glints    | Strong fit for Indonesian digital/tech job discovery           |
| Initial or second ingestion | Jobstreet | Broad job inventory and common user awareness                  |
| Expansion                   | Kalibrr   | Relevant for tech and early-career roles                       |
| Expansion                   | Dealls    | Relevant for Indonesian startup and early-career opportunities |

The exact first source can change if scraper feasibility or access constraints require it. Backend API contracts must not assume only one source exists.

## Source Platform Catalog

Canonical source slugs:

| Display name | Slug        | Notes                           |
| ------------ | ----------- | ------------------------------- |
| Glints       | `glints`    | Target initial source           |
| Jobstreet    | `jobstreet` | Target initial or second source |
| Kalibrr      | `kalibrr`   | Expansion source                |
| Dealls       | `dealls`    | Expansion source                |

Backend API should expose `sourcePlatform.slug` and `sourcePlatform.name` in job responses. It should not expose source-specific raw fields.

## Normalized Contract

Every source should be normalized into the same conceptual job shape:

| Normalized area | Examples                                               |
| --------------- | ------------------------------------------------------ |
| Source identity | source platform, external job id, source URL           |
| Company         | name, logo, website when available                     |
| Role            | title, normalized role/category when available         |
| Description     | sanitized job description                              |
| Requirements    | structured requirement rows or normalized text         |
| Skills          | normalized skill names when extractable                |
| Work type       | remote, hybrid, onsite                                 |
| Employment type | full-time, internship, contract, part-time             |
| Experience      | experience level or raw range normalized when possible |
| Location        | display, province, city                                |
| Salary          | min, max, currency, period, display                    |
| Freshness       | posted date, last seen, source updated date, status    |
| Apply           | external apply URL                                     |

Backend API modules consume only this normalized shape.

## Source-Specific Risk Matrix

| Source    | Key risks                                                                  | Backend expectation                                                 |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Glints    | API/page changes, location and salary inconsistencies, anti-bot behavior   | Read normalized records and stale metadata only                     |
| Jobstreet | Broad taxonomy, salary missing, duplicate listings, page/API changes       | Treat missing salary as unknown and keep filters defensive          |
| Kalibrr   | Smaller inventory variance, field naming drift, stale postings             | Support partial fields and freshness flags                          |
| Dealls    | Startup-specific fields, changing page structure, salary range differences | Rely on normalized fields and avoid source-specific response fields |

## Normalization Rules

### Required Minimum

A job should not become visible in normal search unless it has:

- Internal id.
- Source platform.
- External job id or stable source identity.
- Title.
- Company name or fallback source company text.
- Source URL or external apply URL.
- Last seen timestamp.

### Optional But Preferred

- Description.
- Requirements.
- Skills.
- Location province/city.
- Work type.
- Employment type.
- Experience level.
- Salary min/max.
- Posted date.

Backend API must handle optional missing fields gracefully.

## Salary Normalization

Source salary fields can be inconsistent or missing.

Rules:

- Store normalized integer values for IDR when possible.
- Store `currency`.
- Store `period`, such as `MONTHLY`.
- Store `display` for frontend when sanitized.
- Use `null` for unknown min or max.
- Do not infer precise salary from vague text.
- Salary filters should handle unknown salary records intentionally.

## Location Normalization

Rules:

- Preserve a safe display location.
- Normalize `province` and `city` when possible.
- Allow partial location when source only provides city or free text.
- Do not reject a job solely because province/city normalization fails.
- Backend filters should clearly handle unknown locations.

## Requirement And Skill Normalization

Rules:

- Keep sanitized requirement text.
- Extract skills when confidence is high enough.
- Link to normalized `Skill` records when taxonomy is available.
- Use requirement priority only when source/model/normalizer can support it.
- Do not expose uncertain extraction as definitive if confidence is low.

## Deduplication

Primary identity:

```text
(sourcePlatformId, externalJobId)
```

Rules:

- Deduplicate within a source by source identity.
- Cross-source duplicate detection is future scope.
- Backend API should not merge multiple source records unless product rules are documented.
- Duplicate-looking jobs from different sources may appear separately in MVP.

## Freshness And Staleness

Freshness fields:

- `postedAt` from source when available.
- `lastSeenAt` from scraper observation.
- `sourceUpdatedAt` when source exposes update time.
- `status`: active, stale, expired, closed, or equivalent.

Rules:

- Use `JOB_STALE_AFTER_HOURS` to compute stale display behavior.
- Stale jobs may remain visible if still useful.
- Expired or closed jobs should remain accessible from bookmarks and application history.
- Source outage should degrade freshness, not break Backend API search over existing data.

## Frontend Contract Boundary

Frontend-facing job responses may include:

- `sourcePlatform.name`
- `sourcePlatform.slug`
- normalized job fields
- `externalApplyUrl`
- `isStale`

Frontend-facing job responses must not include:

- Raw source HTML.
- Raw source API response.
- Scraper exception details.
- Source-specific parser metadata.
- Anti-bot or credential information.
- Internal ingestion logs.

## Failure Scenarios

### Source Throttling

Symptoms:

- One platform stops producing fresh jobs.
- `lastSeenAt` degrades for one `sourcePlatform`.
- Scraper run logs show throttling or blocked requests.

Backend behavior:

- Continue serving existing normalized data.
- Do not fail job search solely because one source is throttled.
- Surface stale metadata only if response contract supports it.

### Source Layout Or API Drift

Symptoms:

- New jobs from one platform have missing fields.
- Scraper parser errors increase.
- Salary, location, or requirement fields become malformed.

Backend behavior:

- Guard frontend responses from malformed normalized data.
- Return partial fields where safe.
- Avoid leaking source parser details.
- Log affected source and missing normalized fields.

### Malformed Source Data

Symptoms:

- Source returns inconsistent salary, location, or requirement format.
- Normalized records fail validation.

Backend behavior:

- Do not expose raw malformed data.
- Treat missing optional fields as unknown.
- Block or hide records only when minimum visible job requirements are missing.

### Duplicate Listings

Symptoms:

- Same role appears from multiple sources.
- Same source emits repeated external ids or changed ids.

Backend behavior:

- Rely on `(sourcePlatformId, externalJobId)` for source-local identity.
- Do not perform cross-source merge in MVP.
- Keep user-owned bookmarks/applications tied to internal job ids.

### Database Connectivity Issues

Symptoms:

- Backend cannot read normalized jobs.
- Search, detail, bookmarks, applications, and AI context fail together.

Backend behavior:

- Return `503 SERVICE_UNAVAILABLE`.
- Mark readiness degraded.
- Log database dependency failure.

## Observability

Backend API should log:

- `job_source.stale_source_detected`
- `job_source.missing_normalized_field`
- `job_source.filter_unknown_field`
- `job_source.database_unavailable`

Recommended fields:

- `requestId`
- `sourcePlatform`
- `jobId`
- `missingFields`
- `lastSeenAt`
- `isStale`
- result

Do not log raw source payloads.

## Test Scenarios

Integration tests:

- Source filter accepts `glints`, `jobstreet`, `kalibrr`, and `dealls`.
- Job response includes normalized source name and slug.
- Job response does not include raw source payload fields.
- Missing salary maps to `null` fields without failing response.
- Missing location detail still returns display location when available.
- Stale jobs expose stale metadata when supported.

Contract tests:

- Normalized source platform catalog is seeded consistently.
- `(sourcePlatformId, externalJobId)` uniqueness is enforced.
- Backend jobs module handles each source through the same response mapper.

## Related Docs

- `docs/integrations/scraper-api.md`
- `docs/integrations/model-api.md`
- `docs/modules/jobs.md`
- `docs/database.md`
- `docs/environment.md`
- `references/docs/references/integrations.mdx`
- `references/docs/overview/asynchronous-workflows.mdx`
