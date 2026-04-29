---
title: Bookmarks Module
description: Saved job list, save job, unsave job, duplicate handling, and ownership contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/bookmarks.md
last_reviewed: 2026-04-29
---

# Bookmarks Module

The Bookmarks module owns user-saved job records. It lets authenticated users save jobs from search or detail pages, remove saved jobs, and list saved jobs for later review or AI CV Analyzer job selection.

Bookmarks are user-owned state. They reference normalized `JobListing` records but do not change job catalog ownership.

## Responsibility

The Bookmarks module owns:

- Save job.
- Unsave job.
- List current user's saved jobs.
- Duplicate save handling.
- Ownership enforcement for saved job records.
- Saved job response shape for frontend lists.

The Bookmarks module does not own:

- Job listing source data.
- External apply behavior.
- Application tracker state.
- AI analysis results.
- Cross-user bookmark visibility.

## Route Prefix

```text
/api/v1/me/bookmarks
```

## Endpoint Summary

| Method   | Path                          | Auth          | Purpose                        |
| -------- | ----------------------------- | ------------- | ------------------------------ |
| `GET`    | `/api/v1/me/bookmarks`        | Authenticated | List current user's saved jobs |
| `POST`   | `/api/v1/me/bookmarks`        | Authenticated | Save a job                     |
| `DELETE` | `/api/v1/me/bookmarks/:jobId` | Authenticated | Remove saved job by job id     |

## Auth And Ownership Rules

- Every route requires authenticated user identity.
- Every query or mutation must filter by current `userId`.
- The request body must not accept `userId`.
- A user can only remove their own bookmark.
- Missing bookmark for current user should return `404 BOOKMARK_NOT_FOUND`.
- The referenced job must exist in normalized job data before a bookmark can be created.

## Query Parameters

`GET /api/v1/me/bookmarks` supports:

| Query     | Type   | Default        | Description                                             |
| --------- | ------ | -------------- | ------------------------------------------------------- |
| `page`    | number | `1`            | Page number                                             |
| `limit`   | number | `20`           | Page size, max `100`                                    |
| `keyword` | string | None           | Search saved jobs by title, company, or normalized text |
| `sort`    | enum   | `created_desc` | Saved date or job metadata sort                         |

Supported sort values:

- `created_desc`
- `updated_desc` sorts by the linked job listing's latest normalized update time
- `newest`
- `salary_highest`
- `salary_lowest`

## Request Schemas

### Save Job

```json
{
  "jobId": "11111111-1111-4111-8111-111111111111"
}
```

Validation:

| Field   | Rule                                     |
| ------- | ---------------------------------------- |
| `jobId` | Required UUID of internal job listing id |

## Response Schemas

### Bookmark Resource

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "job": {
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
  },
  "createdAt": "2026-04-22T00:00:00.000Z"
}
```

### List Bookmarks

```json
{
  "success": true,
  "message": "Bookmarks retrieved successfully",
  "data": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "job": {
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
      },
      "createdAt": "2026-04-22T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "filters": {
      "keyword": "backend"
    },
    "sort": "created_desc"
  }
}
```

### Save Bookmark

Successful creation returns HTTP `201`.

```json
{
  "success": true,
  "message": "Job saved successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "jobId": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-04-22T00:00:00.000Z"
  },
  "meta": null
}
```

Delete returns `204` with no response body for MVP.

## Service Logic

### List Bookmarks

1. Require authenticated identity.
2. Validate pagination, keyword, and sort query.
3. Query `Bookmark` by current `userId`.
4. Join normalized `JobListing`, `Company`, and job display fields.
5. Apply keyword search against saved job data.
6. Serialize linked jobs with the same job card shape used by job search.
7. Return list response envelope.

### Save Job

1. Require authenticated identity.
2. Validate `jobId`.
3. Confirm `JobListing` exists and is visible.
4. Check duplicate `(userId, jobListingId)`.
5. Create `Bookmark` if no duplicate exists.
6. Return saved bookmark summary.
7. Emit `bookmarks.created`.

Duplicate behavior:

- MVP behavior: return `409 BOOKMARK_ALREADY_EXISTS`.
- The database must enforce unique `(userId, jobListingId)`.

### Unsave Job

1. Require authenticated identity.
2. Validate `jobId`.
3. Find `Bookmark` by `(userId, jobListingId)`.
4. Return `404 BOOKMARK_NOT_FOUND` when no bookmark exists for current user.
5. Delete or soft delete bookmark.
6. Emit `bookmarks.deleted`.

## Repository And Database Usage

Primary models:

- `Bookmark`
- `JobListing`
- `Company`

Repository responsibilities:

- Query bookmarks by current `userId`.
- Enforce unique `(userId, jobListingId)`.
- Create bookmark.
- Delete bookmark by current `userId` and `jobListingId`.
- Join job card fields without exposing raw source payloads.

Database rules:

- `Bookmark.userId` references `User`.
- `Bookmark.jobListingId` references `JobListing`.
- Unique `(userId, jobListingId)`.
- Index `Bookmark.userId`.
- Index `Bookmark.createdAt` for saved date sorting.

## Error Cases

| Case                  | Status | Error code                |
| --------------------- | ------ | ------------------------- |
| Missing auth          | 401    | `UNAUTHENTICATED`         |
| Invalid query or body | 422    | `VALIDATION_ERROR`        |
| Job not found         | 404    | `JOB_NOT_FOUND`           |
| Bookmark not found    | 404    | `BOOKMARK_NOT_FOUND`      |
| Duplicate bookmark    | 409    | `BOOKMARK_ALREADY_EXISTS` |
| Database unavailable  | 503    | `SERVICE_UNAVAILABLE`     |

## Observability

Log safe structured events:

- `bookmarks.list_requested`
- `bookmarks.created`
- `bookmarks.deleted`
- `bookmarks.duplicate_rejected`

Include:

- `requestId`
- `userId`
- `jobId`
- result
- latency

Do not log raw job descriptions or source payloads.

## Test Scenarios

Unit tests:

- Save schema requires `jobId`.
- Query schema validates pagination and sort.
- Duplicate handling returns `409 BOOKMARK_ALREADY_EXISTS`.

Integration tests:

- Authenticated user can save an existing job.
- Saving a missing job returns `404`.
- Duplicate save returns `409 BOOKMARK_ALREADY_EXISTS`.
- User can list only their own bookmarks.
- Keyword search filters saved jobs.
- User can remove their own bookmark.
- Removing a non-owned or missing bookmark returns `404`.

Route tests:

- All responses follow `docs/api-response-standard.md`.
- Missing auth returns `401`.
- Request body cannot set `userId`.
- Raw scraper fields are absent from bookmark list responses.

## Deferred Decisions

- Whether stale jobs remain in bookmark lists by default.
- Whether bookmark list includes `externalApplyUrl` or leaves it to job detail.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/jobs.md`
- `docs/modules/applications.md`
- `docs/modules/ai-cv-analyzer.md`
