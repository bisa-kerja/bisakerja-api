---
title: Backend API Response Standard
description: Standard response envelopes, errors, pagination, filtering, sorting, request id behavior, and status mapping for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/api-response-standard.md
last_reviewed: 2026-04-29
---

# Backend API Response Standard

The Bisakerja Backend API must return consistent REST JSON responses under `/api/v1`. This standard defines the response envelope, metadata shape, error behavior, and status mapping that every module-specific API contract must follow.

The frontend must receive product-ready payloads from the Backend API. Responses must not expose raw Scraper API payloads, raw Model API internals, secrets, stack traces, or database implementation details.

## Envelope Rules

Every JSON response with a body must include:

| Field     | Type                   | Required     | Description                                                               |
| --------- | ---------------------- | ------------ | ------------------------------------------------------------------------- |
| `success` | boolean                | Yes          | Whether the request completed successfully                                |
| `message` | string                 | Yes          | Human-readable summary safe for frontend display or logging               |
| `data`    | object, array, or null | Yes          | Response payload, or `null` for errors and empty responses with body      |
| `meta`    | object or null         | Success only | Pagination, filters, sorting, request context, or other response metadata |
| `error`   | object or null         | Error only   | Machine-readable error payload                                            |

Rules:

- Success responses must not include `error`.
- Error responses must set `data` to `null`.
- `meta` should be `null` when there is no metadata.
- `message` must be stable enough for the frontend to use as fallback display text.
- Machine branching should use `error.code`, not `message`.

## Success Response

Use this shape for single resource reads, mutations, and action responses that return a body.

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111"
  },
  "meta": null
}
```

## Created Response

Use HTTP `201` when a resource is created.

```json
{
  "success": true,
  "message": "Application record created successfully",
  "data": {
    "id": "app_123",
    "status": "APPLIED"
  },
  "meta": null
}
```

## Empty Response

Use HTTP `204` only when the response body is intentionally empty, such as successful deletion or logout with no returned state.

When the frontend benefits from a confirmation payload, use HTTP `200` with a standard success envelope instead of `204`.

## List Response

Use this shape for paginated collection endpoints.

```json
{
  "success": true,
  "message": "Jobs retrieved successfully",
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "title": "Backend Developer"
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
      "location": "Jakarta",
      "workType": "REMOTE"
    },
    "sort": "relevance"
  }
}
```

## Pagination Metadata

Pagination uses page-based pagination by default.

| Field         | Type    | Required | Rule                                     |
| ------------- | ------- | -------- | ---------------------------------------- |
| `page`        | number  | Yes      | Current page, starting at `1`            |
| `limit`       | number  | Yes      | Items per page                           |
| `total`       | number  | Yes      | Total matching records                   |
| `totalPages`  | number  | Yes      | Total pages based on `total` and `limit` |
| `hasNextPage` | boolean | Yes      | Whether a next page exists               |
| `hasPrevPage` | boolean | Yes      | Whether a previous page exists           |

Default pagination:

| Parameter | Default | Constraint                 |
| --------- | ------- | -------------------------- |
| `page`    | `1`     | Minimum `1`                |
| `limit`   | `20`    | Minimum `1`, maximum `100` |

Invalid pagination values should return `422` with `VALIDATION_ERROR`.

## Filtering Metadata

Collection endpoints should echo accepted filter values in `meta.filters` after validation and normalization.

Common filter keys:

| Filter            | Type   | Applies to                                            |
| ----------------- | ------ | ----------------------------------------------------- |
| `keyword`         | string | Jobs, mentors later, saved jobs, tracked applications |
| `location`        | string | Jobs and preferences                                  |
| `province`        | string | Jobs and preferences when normalized                  |
| `city`            | string | Jobs and preferences when normalized                  |
| `workType`        | enum   | Jobs and preferences                                  |
| `employmentType`  | enum   | Jobs                                                  |
| `experienceLevel` | enum   | Jobs                                                  |
| `salaryMin`       | number | Jobs                                                  |
| `salaryMax`       | number | Jobs                                                  |
| `sourcePlatform`  | string | Jobs and internal debugging views                     |
| `status`          | enum   | Applications                                          |

Rules:

- Omit filters that are not provided.
- Normalize enum values before echoing them.
- Do not echo unsupported query parameters.
- Return `422` for unsupported enum values or invalid filter types.

## Sorting Metadata

Use a single `sort` string for common list endpoints.

Common sort values:

| Sort             | Meaning                                                |
| ---------------- | ------------------------------------------------------ |
| `relevance`      | Best match for keyword, preference, or scoring context |
| `newest`         | Most recently posted or discovered jobs first          |
| `salary_highest` | Highest salary first                                   |
| `salary_lowest`  | Lowest salary first                                    |
| `updated_desc`   | Most recently updated records first                    |
| `created_desc`   | Most recently created records first                    |

Rules:

- Default job search sort is `relevance`.
- If `relevance` cannot be computed for a request, fall back to `newest` and document the behavior in the module contract.
- Return `422` for unsupported sort values.

## Error Response

All error responses must use this shape.

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "path": "email",
        "message": "Invalid email address",
        "code": "invalid_string"
      }
    ],
    "requestId": "req_123"
  }
}
```

Error object fields:

| Field       | Type                    | Required | Description                                  |
| ----------- | ----------------------- | -------- | -------------------------------------------- |
| `code`      | string                  | Yes      | Stable uppercase snake case error code       |
| `details`   | array or object or null | Yes      | Error-specific details safe for frontend use |
| `requestId` | string                  | Yes      | Request id used for logs and support         |

Rules:

- Never include stack traces in API responses.
- Never include raw downstream response bodies if they may contain sensitive data.
- Never include passwords, tokens, OTP values, CV contents, service credentials, or raw model internals.
- Use `requestId` to correlate frontend reports with backend logs.

## Validation Error Details

Zod validation errors should use this detail shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "path": "preferences.salaryMin",
        "message": "Expected number, received string",
        "code": "invalid_type"
      }
    ],
    "requestId": "req_456"
  }
}
```

Validation detail fields:

| Field     | Type   | Required | Description                       |
| --------- | ------ | -------- | --------------------------------- |
| `path`    | string | Yes      | Dot-notated path to invalid field |
| `message` | string | Yes      | Safe validation message           |
| `code`    | string | Yes      | Zod or app-level validation code  |

## Error Code Catalog

| Error code              | Status | Use case                                               |
| ----------------------- | ------ | ------------------------------------------------------ |
| `BAD_REQUEST`           | 400    | Malformed or semantically invalid request              |
| `VALIDATION_ERROR`      | 422    | Zod validation failed                                  |
| `UNAUTHENTICATED`       | 401    | Missing, expired, or invalid token/session             |
| `FORBIDDEN`             | 403    | Authenticated user cannot perform action               |
| `NOT_FOUND`             | 404    | Resource does not exist or is not visible to user      |
| `CONFLICT`              | 409    | Duplicate resource or invalid state transition         |
| `PAYLOAD_TOO_LARGE`     | 413    | Request body or upload exceeds configured limit        |
| `RATE_LIMITED`          | 429    | Request rate limit exceeded                            |
| `DOWNSTREAM_ERROR`      | 502    | Downstream service returned invalid or failed response |
| `SERVICE_UNAVAILABLE`   | 503    | Required dependency unavailable                        |
| `INTERNAL_SERVER_ERROR` | 500    | Unexpected backend failure                             |

Module-specific errors should extend this catalog using stable uppercase snake case codes, such as `APPLICATION_STATUS_CONFLICT` or `BOOKMARK_ALREADY_EXISTS`.

## HTTP Status Mapping

| Status | Use case                                         |
| ------ | ------------------------------------------------ |
| 200    | Successful read or update                        |
| 201    | Resource created                                 |
| 204    | Successful action without response body          |
| 400    | Invalid request syntax or business input         |
| 401    | Missing or invalid authentication                |
| 403    | Authenticated but not authorized                 |
| 404    | Resource not found or not owned by user          |
| 409    | Conflict, duplicate, or invalid state transition |
| 413    | Request body or upload exceeds configured limit  |
| 422    | Zod validation failure for well-formed request   |
| 429    | Rate limit exceeded                              |
| 500    | Unexpected server failure                        |
| 502    | Downstream service failure                       |
| 503    | Dependency unavailable                           |

## Request ID Behavior

- Accept incoming request id from `x-request-id` when provided.
- Generate a request id when one is missing.
- Include request id in every error response.
- Include request id in structured logs.
- Propagate request id to Model API calls.
- Do not require the frontend to generate request ids.

Success responses do not need to include request id unless a module contract explicitly needs it. Error responses always include it.

## Auth Error Behavior

Authentication errors:

```json
{
  "success": false,
  "message": "Authentication required",
  "data": null,
  "error": {
    "code": "UNAUTHENTICATED",
    "details": null,
    "requestId": "req_auth_123"
  }
}
```

Authorization errors:

```json
{
  "success": false,
  "message": "You are not allowed to access this resource",
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "details": null,
    "requestId": "req_auth_456"
  }
}
```

Use `404` instead of `403` when revealing resource existence would leak another user's private data.

## Downstream Failure Behavior

Model API unavailable:

```json
{
  "success": false,
  "message": "AI analysis service is temporarily unavailable",
  "data": null,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "details": {
      "dependency": "model-api"
    },
    "requestId": "req_model_123"
  }
}
```

Model API invalid response:

```json
{
  "success": false,
  "message": "AI analysis result could not be processed",
  "data": null,
  "error": {
    "code": "DOWNSTREAM_ERROR",
    "details": {
      "dependency": "model-api"
    },
    "requestId": "req_model_456"
  }
}
```

Rules:

- Use `503` when a dependency is unavailable or times out.
- Use `502` when a dependency responds but the response is invalid or cannot be trusted.
- Do not expose raw downstream payloads.
- Search, job detail, bookmark, and tracker workflows should not fail only because Model API is unavailable.

## No Raw Internal Payloads

Frontend-facing responses must not include:

- Raw scraper payloads from Glints, Jobstreet, Kalibrr, or Dealls.
- Raw Model API internals.
- Prisma query details.
- Stack traces.
- Secrets or service credentials.
- Raw CV content.

Expose normalized and product-safe fields only.

## Related Docs

- `docs/api-reference.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/environment.md`
- `references/docs/overview/request-response-flows.mdx`
- `references/docs/overview/authentication-and-trust-boundaries.mdx`
