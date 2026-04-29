---
title: Jobs Module
description: Job search, job detail, normalized source data, filtering, sorting, salary, and external apply link contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/jobs.md
last_reviewed: 2026-04-29
---

# Jobs Module

The Jobs module exposes normalized job listings to the Frontend UI. It supports guest and authenticated job discovery, filtering, sorting, job detail views, source platform metadata, company fields, requirements, salary normalization, and external apply links.

The Backend API reads normalized job data. It must not expose raw Scraper API payloads from Glints, Jobstreet, Kalibrr, Dealls, or any future source.

## Responsibility

The Jobs module owns:

- Public job search.
- Public job detail.
- Pagination, filtering, and sorting for normalized job listings.
- Product-ready company and source platform fields.
- Product-ready requirements and skills.
- Salary range presentation from normalized fields.
- External apply link exposure.
- Freshness metadata when documented.

The Jobs module does not own:

- Scraping external job platforms.
- Parsing raw source HTML or raw source APIs.
- Cross-source deduplication unless scraper docs define it.
- Bookmark state.
- Application tracker state.
- AI fit score computation.

## Route Prefix

```text
/api/v1/jobs
```

## Endpoint Summary

| Method | Path                  | Auth   | Purpose                                            |
| ------ | --------------------- | ------ | -------------------------------------------------- |
| `GET`  | `/api/v1/jobs`        | Public | Search, filter, sort, and paginate normalized jobs |
| `GET`  | `/api/v1/jobs/:jobId` | Public | Get normalized job detail                          |

Future authenticated variants may add personalized recommendation metadata, but MVP search and detail must work for guests.

## Auth Rules

- Job search and detail are public.
- Public access still requires validation, rate limiting, and safe response envelopes.
- Authenticated users may receive user-specific metadata later, such as `isBookmarked`, only if it is explicitly documented.
- The Jobs module must not rely on frontend identity for source data access.

## Query Parameters

### Search And Pagination

| Query     | Type   | Default     | Description                                         |
| --------- | ------ | ----------- | --------------------------------------------------- |
| `page`    | number | `1`         | Page number                                         |
| `limit`   | number | `20`        | Page size, max `100`                                |
| `keyword` | string | None        | Search job title, role, company, or normalized text |
| `sort`    | enum   | `relevance` | Sort order                                          |

### Filters

| Query             | Type   | Description                                                               |
| ----------------- | ------ | ------------------------------------------------------------------------- |
| `location`        | string | General location filter                                                   |
| `province`        | string | Province filter when normalized                                           |
| `city`            | string | City filter when normalized                                               |
| `workType`        | enum   | `REMOTE`, `HYBRID`, `ONSITE`                                              |
| `employmentType`  | enum   | Full-time, part-time, internship, contract, or documented enum            |
| `experienceLevel` | enum   | Entry, junior, mid, senior, or documented enum                            |
| `salaryMin`       | number | Minimum salary bound                                                      |
| `salaryMax`       | number | Maximum salary bound                                                      |
| `sourcePlatform`  | string | Normalized source slug such as `glints`, `jobstreet`, `kalibrr`, `dealls` |
| `skill`           | string | Optional skill or expertise filter                                        |
| `category`        | string | Optional division/category filter if normalized                           |

### Sorting

| Sort             | Behavior                                                |
| ---------------- | ------------------------------------------------------- |
| `relevance`      | Default sort by search relevance or product ranking     |
| `newest`         | Newest source posted date or newest observed date first |
| `salary_highest` | Highest normalized salary first                         |
| `salary_lowest`  | Lowest normalized salary first                          |

If `relevance` is requested without a keyword, the API falls back to newest-first ordering and returns `meta.sort` as `newest`. When a keyword is provided, `meta.sort` remains `relevance` while the implementation applies the documented keyword filters and stable newest-first tie-breakers.

## List Response Schema

```json
{
  "success": true,
  "message": "Jobs retrieved successfully",
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "title": "Backend Developer",
      "company": {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Example Tech",
        "logoUrl": "https://cdn.example.com/company-logo.png"
      },
      "sourcePlatform": {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Glints",
        "slug": "glints"
      },
      "workType": "REMOTE",
      "employmentType": "FULL_TIME",
      "experienceLevel": "ENTRY_LEVEL",
      "location": {
        "display": "Jakarta Selatan, DKI Jakarta",
        "province": "DKI Jakarta",
        "city": "Jakarta Selatan"
      },
      "salary": {
        "min": 5000000,
        "max": 10000000,
        "currency": "IDR",
        "period": "MONTHLY",
        "display": "Rp5.000.000 - Rp10.000.000 / bulan"
      },
      "postedAt": "2026-04-20T00:00:00.000Z",
      "lastSeenAt": "2026-04-22T00:00:00.000Z",
      "isStale": false
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "filters": {
      "keyword": "backend",
      "workType": "REMOTE"
    },
    "sort": "relevance"
  }
}
```

List response rules:

- Include fields needed for job cards.
- Do not include full raw description if the card does not need it.
- Do not include raw source payload.
- `isStale` is derived from freshness metadata and `JOB_STALE_AFTER_HOURS`.

## Detail Response Schema

```json
{
  "success": true,
  "message": "Job retrieved successfully",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Backend Developer",
    "company": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Example Tech",
      "logoUrl": "https://cdn.example.com/company-logo.png",
      "websiteUrl": "https://example.com"
    },
    "sourcePlatform": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Glints",
      "slug": "glints"
    },
    "description": "Build and maintain backend APIs.",
    "requirements": [
      {
        "type": "SKILL",
        "value": "TypeScript",
        "priority": "HIGH"
      },
      {
        "type": "EXPERIENCE",
        "value": "0-2 years backend development experience",
        "priority": "MEDIUM"
      }
    ],
    "skills": ["TypeScript", "PostgreSQL", "REST API"],
    "workType": "REMOTE",
    "employmentType": "FULL_TIME",
    "experienceLevel": "ENTRY_LEVEL",
    "location": {
      "display": "Jakarta Selatan, DKI Jakarta",
      "province": "DKI Jakarta",
      "city": "Jakarta Selatan"
    },
    "salary": {
      "min": 5000000,
      "max": 10000000,
      "currency": "IDR",
      "period": "MONTHLY",
      "display": "Rp5.000.000 - Rp10.000.000 / bulan"
    },
    "externalApplyUrl": "https://glints.com/example-job",
    "postedAt": "2026-04-20T00:00:00.000Z",
    "lastSeenAt": "2026-04-22T00:00:00.000Z",
    "isStale": false
  },
  "meta": null
}
```

Detail response rules:

- Include enough normalized fields for AI job fit and CV comparison workflows.
- Preserve external apply URL as a redirect target only, not as proof that the job is still open.
- Include stale/freshness metadata when available.
- Do not expose `externalJobId` unless product needs it for debugging; prefer internal `id`.

## Service Logic

### List Jobs

1. Validate query params with Zod.
2. Normalize filter values.
3. Build repository query against normalized job records.
4. Apply pagination.
5. Apply sort.
6. Join company, source platform, location, salary, and requirements summary as needed.
7. Compute `isStale` from freshness metadata.
8. Return list response envelope with pagination, filters, and sort metadata.

### Get Job Detail

1. Validate `jobId`.
2. Load `JobListing` by internal id.
3. Join `Company`, `SourcePlatform`, `JobRequirement`, and `JobSkill`.
4. Return `404 JOB_NOT_FOUND` if missing or hidden.
5. Shape product-ready detail response.

## Repository And Database Usage

Read models:

- `SourcePlatform`
- `Company`
- `JobListing`
- `JobRequirement`
- `JobSkill`
- `Skill`

Repository responsibilities:

- Query normalized jobs only.
- Apply filters using indexed fields where possible.
- Limit public list results to searchable active or stale normalized records.
- Join company and source platform data.
- Return stable database rows to service mapping layer.
- Never return raw source payload fields to controller.

Write rules:

- The Jobs module does not write scraper-owned job rows in MVP.
- Bookmark and application writes belong to their modules.
- Any future admin correction workflow must be separately documented.

## Normalized Source Fields

`SourcePlatform` response fields:

- `id`
- `name`
- `slug`

Supported source slugs:

- `glints`
- `jobstreet`
- `kalibrr`
- `dealls`

The API accepts source filters by slug through `sourcePlatform`. Display names are returned in response for frontend presentation.

## Company Fields

Company response fields:

- `id`
- `name`
- `logoUrl`
- `websiteUrl` when available

Do not require company website or logo because external sources may not provide them consistently.

## Requirements And Skills

Requirement response fields:

- `type`: `SKILL`, `EXPERIENCE`, `EDUCATION`, `RESPONSIBILITY`, or `OTHER`.
- `value`: normalized text.
- `priority`: `HIGH`, `MEDIUM`, `LOW`, or `UNKNOWN`.

Skill response should prefer normalized skill names. If skill taxonomy is uncertain, return strings in MVP and migrate to structured objects later only with a contract update.

## Salary Normalization

Salary response fields:

- `min`
- `max`
- `currency`
- `period`
- `display`

Rules:

- Use integer values for IDR amounts.
- Use `null` for unknown min or max.
- Do not infer precise salary when source only provides vague text.
- Keep original salary text out of public response unless it is sanitized and documented.
- Salary filtering should include jobs whose range overlaps requested bounds when possible.

## External Apply Link Behavior

- `externalApplyUrl` redirects users to the original job platform.
- Backend does not auto-apply.
- Backend does not guarantee external link availability.
- Clicking apply can later trigger application tracker creation, but that behavior belongs to Applications.
- Never rewrite the external apply URL to include sensitive user data.

## Error Cases

| Case                  | Status | Error code            |
| --------------------- | ------ | --------------------- |
| Invalid query param   | 422    | `VALIDATION_ERROR`    |
| Unsupported filter    | 422    | `VALIDATION_ERROR`    |
| Unsupported sort      | 422    | `VALIDATION_ERROR`    |
| Invalid job id format | 422    | `VALIDATION_ERROR`    |
| Job not found         | 404    | `JOB_NOT_FOUND`       |
| Hidden job detail     | 404    | `JOB_NOT_FOUND`       |
| Database unavailable  | 503    | `SERVICE_UNAVAILABLE` |

## Observability

Log safe structured events:

- `jobs.list_requested`
- `jobs.detail_requested`
- `jobs.search_failed`

Include:

- `requestId`
- `keywordPresent`
- normalized filters
- `sort`
- `page`
- `limit`
- result count
- latency

Do not log raw scraper payloads or full job descriptions by default.

## Test Scenarios

Unit tests:

- Query schema accepts documented filters and rejects unsupported filters.
- Sort schema accepts `relevance`, `newest`, `salary_highest`, and `salary_lowest`.
- Salary overlap filtering handles missing min or max.
- Stale flag computation follows `JOB_STALE_AFTER_HOURS`.
- Response mapper hides raw source payload.

Integration tests:

- `GET /api/v1/jobs` works without auth.
- Pagination metadata is correct.
- Keyword search filters normalized job records.
- Location, work type, salary, and source filters work as documented.
- Unsupported filter values return `422`.
- `GET /api/v1/jobs/:jobId` returns detail with company, source platform, requirements, skills, salary, and external apply URL.
- Missing job returns `404`.

Route tests:

- All responses follow `docs/api-response-standard.md`.
- Public routes do not require auth.
- Raw source payload fields are not present in response JSON.

## Current Behavior Notes

- Public list results include active and stale normalized records. Hidden records are excluded from public responses.
- Public detail returns `JOB_NOT_FOUND` for missing or hidden records.
- Source platform filtering accepts normalized slug values only.
- Category uses the normalized `JobListing.category` field when available.
- Job cards do not include personalized bookmark state.
- Stale records remain visible in search with `isStale` computed from `lastSeenAt` and `JOB_STALE_AFTER_HOURS`.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/bookmarks.md`
- `docs/modules/applications.md`
- `docs/modules/ai-job-fit.md`
- `docs/modules/ai-cv-analyzer.md`
