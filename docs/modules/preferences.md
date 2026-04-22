---
title: Preferences Module
description: Career preference, target role, location, work type, salary range, and notification preference contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/preferences.md
last_reviewed: 2026-04-22
---

# Preferences Module

The Preferences module owns the current user's career preference settings. These settings personalize job discovery, AI job fit scoring, skill gap analysis, and future recommendation or notification workflows.

The MVP uses one active preference set per user.

## Responsibility

The Preferences module owns:

- Career status.
- Job seeking status.
- Target roles.
- Preferred province and city.
- Work type preference.
- Salary range.
- Email notification preference toggle.
- Preference payload used by job fit and recommendation workflows.

The Preferences module does not own:

- Auth identity fields.
- General user profile fields such as display name or phone number.
- Job listing filters persisted outside the user's active preference set.
- Notification delivery infrastructure.
- Mentoring preferences.

## Route Prefix

Preferred current-user route:

```text
/api/v1/me/preferences
```

Alternative `/api/v1/preferences` may exist as an alias only if the API reference is updated consistently.

## Endpoint Summary

| Method  | Path                     | Auth          | Purpose                                                    |
| ------- | ------------------------ | ------------- | ---------------------------------------------------------- |
| `GET`   | `/api/v1/me/preferences` | Authenticated | Get current user's active career preferences               |
| `PUT`   | `/api/v1/me/preferences` | Authenticated | Replace or upsert current user's active career preferences |
| `PATCH` | `/api/v1/me/preferences` | Authenticated | Partially update current user's active career preferences  |

Use `PUT` for onboarding save flows where the frontend submits the full preference state. Use `PATCH` only after partial edit behavior is implemented and tested.

## Auth And Ownership Rules

- Every route requires authenticated user identity.
- Preferences always belong to the authenticated current user.
- The request body must not accept `userId`.
- The backend uses persisted preferences when preparing Model API payloads.
- Missing preferences should return `404` or an empty onboarding state depending on the endpoint contract. For MVP, `GET` may return `404 PREFERENCES_NOT_FOUND` until preferences are created.

## Domain Enums

### Career Status

| Value             | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `FRESH_GRADUATE`  | User is entering workforce after graduation          |
| `EARLY_CAREER`    | User has roughly 0 to 3 years of experience          |
| `CAREER_SWITCHER` | User is moving into a new digital or technology role |

### Job Seeking Status

| Value          | Meaning                              |
| -------------- | ------------------------------------ |
| `IMMEDIATE`    | User wants a job as soon as possible |
| `ONE_MONTH`    | User targets around 1 month          |
| `THREE_MONTHS` | User targets around 3 months         |

### Work Type

| Value    | Meaning      |
| -------- | ------------ |
| `REMOTE` | Remote work  |
| `HYBRID` | Hybrid work  |
| `ONSITE` | On-site work |

If the frontend uses Indonesian labels, the API must still use canonical enum values and let the frontend translate labels.

## Request Schemas

### Upsert Preferences

```json
{
  "careerStatus": "FRESH_GRADUATE",
  "jobSeekingStatus": "IMMEDIATE",
  "targetRoles": ["Backend Developer", "Full Stack Developer"],
  "locations": [
    {
      "province": "DKI Jakarta",
      "city": "Jakarta Selatan"
    }
  ],
  "workTypes": ["REMOTE", "HYBRID"],
  "salaryExpectation": {
    "min": 5000000,
    "max": 10000000,
    "currency": "IDR",
    "period": "MONTHLY"
  },
  "emailNotificationsEnabled": true
}
```

Validation:

| Field                        | Rule                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `careerStatus`               | Required enum                                         |
| `jobSeekingStatus`           | Required enum                                         |
| `targetRoles`                | Required non-empty array for completed onboarding     |
| `locations`                  | Required non-empty array for completed onboarding     |
| `locations[].province`       | Required when location is provided                    |
| `locations[].city`           | Optional only if province-level preference is allowed |
| `workTypes`                  | Required array of supported work type enums           |
| `salaryExpectation.min`      | Optional number, must be non-negative                 |
| `salaryExpectation.max`      | Optional number, must be greater than or equal to min |
| `salaryExpectation.currency` | Default `IDR`                                         |
| `salaryExpectation.period`   | Default `MONTHLY`                                     |
| `emailNotificationsEnabled`  | Required boolean                                      |

## Response Schema

```json
{
  "success": true,
  "message": "Preferences retrieved successfully",
  "data": {
    "id": "pref_123",
    "careerStatus": "FRESH_GRADUATE",
    "jobSeekingStatus": "IMMEDIATE",
    "targetRoles": ["Backend Developer", "Full Stack Developer"],
    "locations": [
      {
        "province": "DKI Jakarta",
        "city": "Jakarta Selatan"
      }
    ],
    "workTypes": ["REMOTE", "HYBRID"],
    "salaryExpectation": {
      "min": 5000000,
      "max": 10000000,
      "currency": "IDR",
      "period": "MONTHLY"
    },
    "emailNotificationsEnabled": true,
    "createdAt": "2026-04-22T00:00:00.000Z",
    "updatedAt": "2026-04-22T00:00:00.000Z"
  },
  "meta": null
}
```

## Service Logic

### Get Preferences

1. Require authenticated identity.
2. Load active `UserPreference` by current `userId`.
3. Return `404 PREFERENCES_NOT_FOUND` if no active preferences exist.
4. Shape response using canonical enum values.

### Upsert Preferences

1. Require authenticated identity.
2. Validate request body with Zod.
3. Normalize target role names and location strings.
4. Validate salary range.
5. Upsert one active `UserPreference` for the user.
6. Recompute onboarding status if this completes onboarding.
7. Return updated preferences.
8. Emit audit event `preferences.updated`.

### Partial Update

1. Require authenticated identity.
2. Validate partial body.
3. Reject empty body.
4. Merge with existing preferences.
5. Re-run full preference validation after merge.
6. Persist updated preferences.

## Repository And Database Usage

Primary models:

- `UserPreference`
- Optional `TargetRole`
- Optional `Location`
- `User` for onboarding status update coordination

Repository responsibilities:

- Find active preferences by `userId`.
- Upsert active preference set by `userId`.
- Update notification preference toggle.
- Persist normalized arrays either as relational records or JSON according to final schema decision.

Database rules:

- One active `UserPreference` per `User` in MVP.
- If arrays are stored as JSON, do not query them for advanced filtering until indexes or relational tables are introduced.
- If target roles and locations are normalized, enforce unique normalized names.
- Salary values must use integer minor units or a documented numeric strategy to avoid floating precision issues.

## Preference Usage By Other Modules

| Consumer       | Usage                                                          |
| -------------- | -------------------------------------------------------------- |
| Jobs           | Optional personalized filtering or future recommendation boost |
| AI Job Fit     | Preference match component of fit score                        |
| AI CV Analyzer | Optional context for target role alignment                     |
| Notifications  | Email preference toggle and future job recommendation triggers |
| Users          | Onboarding completion calculation                              |

Consumers must read persisted preferences from Backend API persistence, not trust frontend-supplied preference context for AI scoring.

## Error Cases

| Case                                                | Status | Error code              |
| --------------------------------------------------- | ------ | ----------------------- |
| Missing auth                                        | 401    | `UNAUTHENTICATED`       |
| Preferences not found                               | 404    | `PREFERENCES_NOT_FOUND` |
| Invalid enum value                                  | 422    | `VALIDATION_ERROR`      |
| Empty target role list during onboarding completion | 422    | `VALIDATION_ERROR`      |
| Invalid salary range                                | 422    | `INVALID_SALARY_RANGE`  |
| Empty patch body                                    | 400    | `BAD_REQUEST`           |

## Observability

Log safe structured events:

- `preferences.viewed`
- `preferences.created`
- `preferences.updated`
- `preferences.notification_toggle_updated`

Include:

- `requestId`
- `userId`
- changed field names
- result

Do not log full salary payload if product policy later treats it as sensitive. Logging changed field names is enough.

## Test Scenarios

Unit tests:

- Career status enum accepts documented values only.
- Job seeking status enum accepts documented values only.
- Salary validation rejects max lower than min.
- Partial update merge revalidates full preference object.
- Location normalization is deterministic.

Integration tests:

- `GET /api/v1/me/preferences` requires auth.
- Missing preferences return documented not found behavior.
- `PUT /api/v1/me/preferences` creates active preferences.
- Repeated `PUT` updates the same active preference set.
- Notification toggle persists.
- Preference update can trigger onboarding status recomputation.

Route tests:

- All responses follow `docs/api-response-standard.md`.
- Invalid enum values return `422`.
- Request body cannot set `userId`.

## Open Decisions

- Whether target roles and locations are relational tables or JSON fields in MVP.
- Whether `careerStatus` belongs only here or is also denormalized in `UserProfile`.
- Whether `GET` missing preferences returns `404` or a default empty preference object.
- Whether salary values use integer IDR values or structured minor units.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/users.md`
- `docs/modules/jobs.md`
- `docs/modules/ai-job-fit.md`
