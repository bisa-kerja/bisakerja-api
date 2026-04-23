---
title: Applications Module
description: Application tracker creation, status transitions, notes, search, external apply relationship, and ownership contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/applications.md
last_reviewed: 2026-04-22
---

# Applications Module

The Applications module owns the user-specific application tracker. It lets authenticated users track jobs they applied to, update status, search tracked jobs, and preserve the feedback loop needed for Application Intelligence.

Application tracker records are user-owned state. They reference normalized `JobListing` records and must stay useful even if a job becomes stale, expired, or unavailable on the original source platform. `ApplicationStatusHistory` is part of the MVP tracker audit trail.

## Responsibility

The Applications module owns:

- Create tracker record.
- List tracked applications.
- Update tracker notes and metadata.
- Update application status.
- Validate status transitions.
- Track relationship between external apply click and tracker state when implemented.
- Preserve user ownership and status transition history when history is enabled.

The Applications module does not own:

- External job application submission.
- ATS or employer-system integration.
- Job listing source data.
- Bookmark state.
- AI scoring output, although it may later consume AI result snapshots for insight.

## Route Prefix

```text
/api/v1/me/applications
```

## Endpoint Summary

| Method  | Path                                            | Auth                                  | Purpose                                  |
| ------- | ----------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `GET`   | `/api/v1/me/applications`                       | Authenticated                         | List current user's tracked applications |
| `POST`  | `/api/v1/me/applications`                       | Authenticated                         | Create a tracker record                  |
| `PATCH` | `/api/v1/me/applications/:applicationId`        | Authenticated and ownership-protected | Update tracker note or metadata          |
| `PATCH` | `/api/v1/me/applications/:applicationId/status` | Authenticated and ownership-protected | Update application status                |

## Auth And Ownership Rules

- Every route requires authenticated user identity.
- Every query or mutation must filter by current `userId`.
- Request body must not accept `userId`.
- A user can only read or mutate their own tracker records.
- Use `404 APPLICATION_NOT_FOUND` when a tracker record does not belong to current user.

## Query Parameters

`GET /api/v1/me/applications` supports:

| Query     | Type   | Default        | Description                            |
| --------- | ------ | -------------- | -------------------------------------- |
| `page`    | number | `1`            | Page number                            |
| `limit`   | number | `20`           | Page size, max `100`                   |
| `keyword` | string | None           | Search by job title, company, or notes |
| `status`  | enum   | None           | Filter by application status           |
| `sort`    | enum   | `updated_desc` | Sort order                             |

Supported sort values:

- `updated_desc`
- `created_desc`
- `newest`

## Status Values

Canonical backend statuses:

| Status      | Meaning                                                      | UI label example    |
| ----------- | ------------------------------------------------------------ | ------------------- |
| `APPLIED`   | User has applied or clicked apply and wants to track the job | Diproses or Applied |
| `INTERVIEW` | User is in interview process                                 | Interview           |
| `REJECTED`  | User was rejected or decided to mark unsuccessful            | Ditolak             |
| `ACCEPTED`  | User received or accepted an offer                           | Diterima            |

If the UI uses `DIPROSES`, map it to canonical `APPLIED` before persistence.

## Status Transition Rules

MVP transition policy:

| From        | Allowed to                          |
| ----------- | ----------------------------------- |
| none        | `APPLIED`                           |
| `APPLIED`   | `INTERVIEW`, `REJECTED`, `ACCEPTED` |
| `INTERVIEW` | `REJECTED`, `ACCEPTED`, `APPLIED`   |
| `REJECTED`  | `APPLIED`, `INTERVIEW`, `ACCEPTED`  |
| `ACCEPTED`  | `APPLIED`, `INTERVIEW`, `REJECTED`  |

The MVP allows correction transitions because users may fix tracker mistakes. If stricter transitions are desired later, update this doc and tests before implementation.

## Request Schemas

### Create Tracker Record

```json
{
  "jobId": "job_123",
  "status": "APPLIED",
  "notes": "Applied from Glints after reviewing fit score.",
  "source": "EXTERNAL_APPLY_CLICK"
}
```

Validation:

| Field    | Rule                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| `jobId`  | Required internal job listing id                                                 |
| `status` | Optional, defaults to `APPLIED`; initial tracker records must start as `APPLIED` |
| `notes`  | Optional, max `2000` characters                                                  |
| `source` | Optional enum: `MANUAL`, `EXTERNAL_APPLY_CLICK`                                  |

### Update Tracker

```json
{
  "notes": "Recruiter replied and asked for availability.",
  "source": "MANUAL"
}
```

### Update Status

```json
{
  "status": "INTERVIEW",
  "notes": "First interview scheduled for Friday."
}
```

## Response Schema

### Application Resource

```json
{
  "id": "application_123",
  "status": "APPLIED",
  "notes": "Applied from Glints after reviewing fit score.",
  "source": "EXTERNAL_APPLY_CLICK",
  "appliedAt": "2026-04-22T00:00:00.000Z",
  "updatedAt": "2026-04-22T00:00:00.000Z",
  "job": {
    "id": "job_123",
    "title": "Backend Developer",
    "company": {
      "id": "company_123",
      "name": "Example Tech",
      "logoUrl": "https://cdn.example.com/company-logo.png"
    },
    "sourcePlatform": {
      "id": "source_123",
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
}
```

### List Applications

```json
{
  "success": true,
  "message": "Applications retrieved successfully",
  "data": [
    {
      "id": "application_123",
      "status": "APPLIED",
      "notes": "Applied from Glints after reviewing fit score.",
      "source": "EXTERNAL_APPLY_CLICK",
      "appliedAt": "2026-04-22T00:00:00.000Z",
      "updatedAt": "2026-04-22T00:00:00.000Z",
      "job": {
        "id": "job_123",
        "title": "Backend Developer",
        "company": {
          "id": "company_123",
          "name": "Example Tech",
          "logoUrl": "https://cdn.example.com/company-logo.png"
        },
        "sourcePlatform": {
          "id": "source_123",
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
      "status": "APPLIED"
    },
    "sort": "updated_desc"
  }
}
```

## Service Logic

### List Applications

1. Require authenticated identity.
2. Validate pagination, keyword, status, and sort query.
3. Query `ApplicationRecord` by current `userId`.
4. Join normalized `JobListing` and `Company`.
5. Return list response envelope.

### Create Tracker Record

1. Require authenticated identity.
2. Validate request body.
3. Confirm referenced `JobListing` exists.
4. Check existing active `(userId, jobListingId)` tracker record.
5. Create `ApplicationRecord` with initial status `APPLIED`.
6. Create the initial `ApplicationStatusHistory` row.
7. Emit `applications.created`.
8. Return created tracker record.

Duplicate behavior:

- MVP behavior: return `409 APPLICATION_ALREADY_TRACKED`.
- If external apply click becomes idempotent later, document and test that route behavior separately before implementation.

### Update Tracker

1. Require authenticated identity.
2. Validate request body.
3. Load tracker by `applicationId` and current `userId`.
4. Update allowed fields such as notes.
5. Return updated tracker record.

### Update Status

1. Require authenticated identity.
2. Validate status body.
3. Load tracker by `applicationId` and current `userId`.
4. Validate transition.
5. Update `status`.
6. Append `ApplicationStatusHistory`.
7. Emit `applications.status_updated`.
8. Return updated tracker record.

## External Apply Relationship

Job detail exposes `externalApplyUrl`. Clicking that link may create a tracker record automatically in a future frontend/backend flow.

MVP rule:

- Backend does not submit applications to external platforms.
- Backend may create tracker record with `source: EXTERNAL_APPLY_CLICK` if frontend calls the create endpoint before redirect.
- Tracker creation must not block redirect if the product chooses frontend-first redirect behavior.
- External platform response is not known to Backend API.

## Repository And Database Usage

Primary models:

- `ApplicationRecord`
- `ApplicationStatusHistory`
- `JobListing`
- `Company`

Repository responsibilities:

- Query application records by current `userId`.
- Create tracker record.
- Update tracker fields.
- Update status.
- Append status history on tracker creation and status update.
- Enforce unique active `(userId, jobListingId)`.

Database rules:

- `ApplicationRecord.userId` references `User`.
- `ApplicationRecord.jobListingId` references `JobListing`.
- Unique active `(userId, jobListingId)`.
- Index `status`.
- Index `updatedAt`.
- Keep tracker rows valid even when job becomes stale or expired.

## Error Cases

| Case                      | Status | Error code                    |
| ------------------------- | ------ | ----------------------------- |
| Missing auth              | 401    | `UNAUTHENTICATED`             |
| Invalid query or body     | 422    | `VALIDATION_ERROR`            |
| Job not found             | 404    | `JOB_NOT_FOUND`               |
| Application not found     | 404    | `APPLICATION_NOT_FOUND`       |
| Duplicate tracker record  | 409    | `APPLICATION_ALREADY_TRACKED` |
| Invalid status transition | 409    | `APPLICATION_STATUS_CONFLICT` |
| Database unavailable      | 503    | `SERVICE_UNAVAILABLE`         |

## Observability

Log safe structured events:

- `applications.list_requested`
- `applications.created`
- `applications.updated`
- `applications.status_updated`
- `applications.duplicate_rejected`

Include:

- `requestId`
- `userId`
- `jobId`
- `applicationId`
- `fromStatus`
- `toStatus`
- result

Do not log full notes by default.

## Test Scenarios

Unit tests:

- Status enum accepts documented values.
- Status transition policy allows corrections as documented.
- Query schema validates status and sort.
- Create schema defaults status to `APPLIED`.

Integration tests:

- Authenticated user can create tracker record for existing job.
- Duplicate tracker creation returns `409`.
- User can list only their own applications.
- Status filter returns matching tracker records.
- User can update notes.
- User can update status and history is appended.
- Non-owned tracker update returns `404`.

Route tests:

- All responses follow `docs/api-response-standard.md`.
- Missing auth returns `401`.
- Request body cannot set `userId`.
- Application list does not expose raw source payloads.

## Deferred Decisions

- Whether external apply click always auto-creates tracker record.
- Whether duplicate external apply click is idempotent.
- Maximum note length.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/jobs.md`
- `docs/modules/bookmarks.md`
- `docs/modules/ai-job-fit.md`
