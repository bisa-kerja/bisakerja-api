---
title: AI Job Fit Module
description: Job fit scoring, skill gap, explanation breakdown, recommendation, model payload, and downstream failure contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-job-fit.md
last_reviewed: 2026-04-23
---

# AI Job Fit Module

The AI Job Fit module evaluates how well an authenticated user matches a normalized job listing. It prepares backend-owned context from the database, calls Model API, maps the result into product-safe output, and optionally stores result snapshots.

The frontend receives explanation-oriented output, not raw model internals.

## Responsibility

The AI Job Fit module owns:

- Backend-prepared inference payload assembly.
- Job fit score request.
- Fit score range and response contract.
- Explanation breakdown.
- Skill match output.
- Experience match output.
- Preference match output.
- Skill gap output.
- Career strategy recommendation output.
- Downstream Model API error mapping.
- Optional persistence of AI result snapshots.

The AI Job Fit module does not own:

- Model training.
- Model artifact management.
- Model API runtime.
- User authorization decisions inside Model API.
- Raw job scraping or normalization.

## Route Prefix

```text
/api/v1/ai/job-fit
```

## Endpoint Summary

| Method | Path                 | Auth          | Purpose                                       |
| ------ | -------------------- | ------------- | --------------------------------------------- |
| `POST` | `/api/v1/ai/job-fit` | Authenticated | Analyze current user's fit for a selected job |

Future history endpoints may be added only after result persistence is implemented.

## Auth And Ownership Rules

- Route requires authenticated user identity.
- Backend loads user profile and preferences from database.
- Request body must not include trusted user profile or preference data.
- Referenced job must exist in normalized job data.
- Model API must not decide whether the user can request analysis.
- Backend may store result snapshots only under current `userId`.

## Request Schema

```json
{
  "jobId": "job_123",
  "persistResult": true
}
```

Validation:

| Field           | Rule                              |
| --------------- | --------------------------------- |
| `jobId`         | Required internal job listing id  |
| `persistResult` | Optional boolean, default `false` |

Rules:

- Do not accept user skills, experience, or preferences in this request body.
- Use persisted backend data so scoring is consistent and auditable.
- Return `404 JOB_NOT_FOUND` if job does not exist.
- Return `409 PROFILE_INCOMPLETE` if required profile context is missing.
- Return `409 PREFERENCES_INCOMPLETE` if persisted target role, location, or work type preferences are missing.

## Backend-Prepared Model Payload

The backend prepares a minimal internal payload for Model API.

```json
{
  "requestId": "req_123",
  "user": {
    "careerStatus": "FRESH_GRADUATE",
    "skills": [
      {
        "name": "TypeScript",
        "level": "INTERMEDIATE"
      }
    ],
    "experience": [
      {
        "title": "Backend Developer Intern",
        "description": "Built REST APIs with TypeScript."
      }
    ]
  },
  "preferences": {
    "targetRoles": ["Backend Developer"],
    "locations": [
      {
        "province": "DKI Jakarta",
        "city": "Jakarta Selatan"
      }
    ],
    "workTypes": ["REMOTE"],
    "salaryExpectation": {
      "min": 5000000,
      "max": 10000000,
      "currency": "IDR",
      "period": "MONTHLY"
    }
  },
  "job": {
    "id": "job_123",
    "title": "Backend Developer",
    "description": "Build and maintain backend APIs.",
    "requirements": [
      {
        "type": "SKILL",
        "value": "TypeScript",
        "priority": "HIGH"
      }
    ],
    "skills": ["TypeScript", "PostgreSQL"],
    "workType": "REMOTE",
    "experienceLevel": "ENTRY_LEVEL",
    "location": {
      "province": "DKI Jakarta",
      "city": "Jakarta Selatan"
    },
    "salary": {
      "min": 5000000,
      "max": 10000000,
      "currency": "IDR",
      "period": "MONTHLY"
    }
  }
}
```

Payload rules:

- Include only fields required for inference.
- Do not send password, tokens, OTP values, raw CV content, or service credentials.
- Include `requestId` for tracing.
- Validate Model API response before sending data to frontend.

## Response Schema

```json
{
  "success": true,
  "message": "Job fit analysis completed successfully",
  "data": {
    "jobId": "job_123",
    "fitScore": 82,
    "readinessLevel": "READY_WITH_MINOR_GAPS",
    "recommendation": {
      "decision": "APPLY_NOW",
      "summary": "You match the core backend requirements, with minor gaps in deployment experience.",
      "nextSteps": [
        "Highlight TypeScript API experience in your CV.",
        "Review PostgreSQL query optimization basics.",
        "Prepare examples of backend project impact."
      ],
      "successProbability": 0.68
    },
    "breakdown": {
      "skillMatch": {
        "score": 85,
        "matchedSkills": ["TypeScript", "PostgreSQL"],
        "missingSkills": ["Docker"]
      },
      "experienceMatch": {
        "score": 75,
        "reason": "Internship experience is aligned with entry-level backend responsibilities."
      },
      "preferenceMatch": {
        "score": 90,
        "matchedPreferences": ["REMOTE", "DKI Jakarta"],
        "unmatchedPreferences": []
      }
    },
    "skillGaps": [
      {
        "skill": "Docker",
        "priority": "MEDIUM",
        "reason": "The job mentions containerized deployment experience."
      }
    ],
    "model": {
      "name": "job-fit-model",
      "version": "v1"
    },
    "analyzedAt": "2026-04-22T00:00:00.000Z"
  },
  "meta": null
}
```

## Score And Output Rules

Fit score:

- Integer from `0` to `100`.
- Higher is better.
- Must be explainable through breakdown fields.

Readiness level:

| Value                   | Meaning                             |
| ----------------------- | ----------------------------------- |
| `READY`                 | Strong match and low gap            |
| `READY_WITH_MINOR_GAPS` | Good match with manageable gaps     |
| `NEEDS_PREPARATION`     | Meaningful gaps should be addressed |
| `NOT_RECOMMENDED_YET`   | Current profile is poorly aligned   |

Recommendation decision:

| Value             | Meaning                                        |
| ----------------- | ---------------------------------------------- |
| `APPLY_NOW`       | User should consider applying now              |
| `IMPROVE_FIRST`   | User should improve key skills before applying |
| `SAVE_FOR_LATER`  | User may bookmark and revisit                  |
| `NOT_RECOMMENDED` | Job is not a good current target               |

Skill gap priority:

- `HIGH`
- `MEDIUM`
- `LOW`

## Service Logic

1. Require authenticated identity.
2. Validate request body.
3. Load current `UserProfile`, `UserSkill`, `UserExperience`, `UserPreference`, and `JobListing`.
4. Confirm required profile and preference data exists.
5. Build backend-prepared Model API payload.
6. Call Model API with timeout and request id.
7. Validate Model API response with Zod.
8. Map Model API output to product-safe response.
9. Optionally persist `FitScoreResult` and `SkillGapResult` snapshots.
10. Return standard success envelope.

## Repository And Database Usage

Read models:

- `User`
- `UserProfile`
- `UserSkill`
- `Skill`
- `UserExperience`
- `UserPreference`
- `JobListing`
- `JobRequirement`
- `JobSkill`
- `Company`

Optional write models:

- `FitScoreResult`
- `SkillGapResult`
- `AiRequestLog`

Persistence rules:

- Persist derived outputs only when `persistResult=true`.
- Store model version when available.
- Store sanitized input summary, not full raw model payload.
- Do not let Model API write directly to PostgreSQL.

## Downstream Failure Behavior

| Failure                    | Status | Error code               | Behavior                                 |
| -------------------------- | ------ | ------------------------ | ---------------------------------------- |
| Model API timeout          | 503    | `SERVICE_UNAVAILABLE`    | AI route fails, other modules unaffected |
| Model API unavailable      | 503    | `SERVICE_UNAVAILABLE`    | Return dependency-safe error             |
| Model API invalid response | 502    | `DOWNSTREAM_ERROR`       | Reject untrusted output                  |
| Missing profile data       | 409    | `PROFILE_INCOMPLETE`     | Ask user to complete profile             |
| Missing preferences        | 409    | `PREFERENCES_INCOMPLETE` | Ask user to complete preferences         |
| Job not found              | 404    | `JOB_NOT_FOUND`          | No model call                            |

## Error Cases

| Case                   | Status | Error code               |
| ---------------------- | ------ | ------------------------ |
| Missing auth           | 401    | `UNAUTHENTICATED`        |
| Invalid request body   | 422    | `VALIDATION_ERROR`       |
| Job not found          | 404    | `JOB_NOT_FOUND`          |
| Profile incomplete     | 409    | `PROFILE_INCOMPLETE`     |
| Preferences incomplete | 409    | `PREFERENCES_INCOMPLETE` |
| Model unavailable      | 503    | `SERVICE_UNAVAILABLE`    |
| Model invalid response | 502    | `DOWNSTREAM_ERROR`       |

## Observability

Log safe structured events:

- `ai_job_fit.requested`
- `ai_job_fit.completed`
- `ai_job_fit.failed`
- `ai_job_fit.persisted`

Include:

- `requestId`
- `userId`
- `jobId`
- `fitScore` when completed
- `modelVersion` when available
- dependency latency
- result

Do not log full model payloads, full job descriptions, or sensitive profile data.

## Test Scenarios

Unit tests:

- Request schema rejects missing `jobId`.
- Payload builder excludes sensitive fields.
- Fit score response schema accepts only `0` to `100`.
- Readiness level and recommendation enums reject unsupported values.
- Downstream error mapper maps timeout to `503` and invalid response to `502`.

Integration tests:

- Authenticated user can request job fit for existing job.
- Missing auth returns `401`.
- Missing job returns `404` without calling Model API.
- Incomplete profile returns `409`.
- Incomplete preferences return `409`.
- Model API success returns product-safe response.
- Model API timeout returns `503`.
- Persist enabled stores result snapshots.
- Model API failures do not break public job search routes.

Route tests:

- Response follows `docs/api-response-standard.md`.
- Request body cannot override user profile or preference data.
- Raw model internals are not present in response.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/modules/users.md`
- `docs/modules/preferences.md`
- `docs/modules/jobs.md`
- `docs/modules/ai-cv-analyzer.md`
