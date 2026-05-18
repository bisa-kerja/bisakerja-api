---
title: AI Job Recommendations Module
description: CV-analysis-based job recommendation generation, ownership guarantees, model payload contract, and recommendation snapshot retrieval for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-job-recommendations.md
last_reviewed: 2026-05-18
---

# AI Job Recommendations Module

The AI Job Recommendations module generates a bounded job recommendation list for the authenticated user by combining:

- an owned CV analysis snapshot,
- normalized active job inventory,
- and Model API reranking.

The backend owns candidate selection, ownership checks, response validation, and persistence. The model only reranks candidate jobs provided by backend.

## Responsibility

The module owns:

- CV analysis ownership resolution.
- Candidate job filtering from backend database.
- Backend-prepared recommendation payload assembly.
- Model output validation against backend candidate set.
- Recommendation snapshot persistence.
- Recommendation run retrieval for current user.

The module does not own:

- Job ingestion/normalization.
- User profile or preference authoring.
- Model training or model runtime operations.

## Route Prefix

```text
/api/v1/ai/job-recommendations
```

## Endpoint Summary

| Method | Path                                                  | Auth          | Purpose                                                           |
| ------ | ----------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| `POST` | `/api/v1/ai/job-recommendations`                      | Authenticated | Generate recommendation run from owned CV analysis and candidates |
| `GET`  | `/api/v1/ai/job-recommendations/latest`               | Authenticated | Get latest recommendation run for current user                    |
| `GET`  | `/api/v1/ai/job-recommendations/:recommendationRunId` | Authenticated | Get one recommendation run detail for current user                |

## Auth And Ownership Rules

- Route requires authenticated user identity.
- `cvAnalysisResultId` is optional.
- If `cvAnalysisResultId` is provided, it must belong to current user.
- If `cvAnalysisResultId` is omitted, backend resolves latest CV analysis for current user.
- Missing/non-owned explicit `cvAnalysisResultId` returns `404 CV_ANALYSIS_RESULT_NOT_FOUND`.
- Missing fallback analysis returns `422 CV_ANALYSIS_REQUIRED`.
- Recommendation run reads are user-scoped and conceal non-owned ids with `404 JOB_RECOMMENDATION_NOT_FOUND`.

## Request Schema

```json
{
  "cvAnalysisResultId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "limit": 10,
  "idempotencyKey": "idem-123",
  "filters": {
    "location": "Jakarta Selatan",
    "workType": "REMOTE",
    "experienceLevel": "ENTRY_LEVEL",
    "excludeAppliedJobs": true,
    "includeBookmarkedStatus": true
  }
}
```

Validation:

| Field                             | Rule                                   |
| --------------------------------- | -------------------------------------- | ------ | ------- |
| `cvAnalysisResultId`              | Optional UUID                          |
| `limit`                           | Optional integer `1..20`, default `10` |
| `idempotencyKey`                  | Optional non-empty string              |
| `filters.location`                | Optional string                        |
| `filters.workType`                | Optional enum `REMOTE                  | HYBRID | ONSITE` |
| `filters.experienceLevel`         | Optional experience enum               |
| `filters.excludeAppliedJobs`      | Optional boolean, default `true`       |
| `filters.includeBookmarkedStatus` | Optional boolean, default `true`       |

## Candidate Selection Rules

- Only candidate jobs with status `ACTIVE` or `STALE`.
- Exclude expired jobs (`expiredAt <= now`).
- Apply optional location/work-type/experience filters.
- Exclude applied jobs by default unless request overrides.
- Use deterministic pre-ranking before model call.
- Send bounded candidate list to model (`maxModelCandidateJobs`).

## Backend-Prepared Model Payload

```json
{
  "requestId": "req_123",
  "inputVersion": "job-recommendations-v1",
  "talentProfile": {
    "targetRole": "Backend Developer",
    "seniorityLevel": "ENTRY_LEVEL",
    "hardSkills": ["TypeScript", "PostgreSQL"],
    "softSkills": [],
    "domainSignals": ["Engineering"],
    "toolsAndTechnologies": ["REST API"],
    "educationSignals": [],
    "experienceYearsEstimate": null,
    "locationPreferences": [
      {
        "province": "DKI Jakarta",
        "city": "Jakarta Selatan"
      }
    ],
    "workTypePreferences": ["REMOTE"],
    "salaryExpectation": {
      "min": 5000000,
      "max": 10000000,
      "currency": "IDR",
      "period": "MONTHLY"
    },
    "redFlags": ["Docker"]
  },
  "rankingPolicy": {
    "maxRecommendations": 10,
    "requireCandidateJobIds": true,
    "deduplicateByJobId": true
  },
  "jobCandidates": [
    {
      "jobId": "11111111-1111-4111-8111-111111111111",
      "title": "Backend Developer",
      "companyName": "Nusantara Tech",
      "location": {
        "display": "Jakarta Selatan, DKI Jakarta",
        "province": "DKI Jakarta",
        "city": "Jakarta Selatan"
      },
      "workType": "REMOTE",
      "experienceLevel": "ENTRY_LEVEL",
      "descriptionSummary": "Build backend APIs.",
      "requiredSkills": ["TypeScript", "PostgreSQL"],
      "postedAt": "2026-05-18T00:00:00.000Z",
      "sourceUpdatedAt": null
    }
  ]
}
```

Payload rules:

- Backend builds and sanitizes payload; frontend cannot inject candidate jobs.
- Include only minimal fields needed for reranking.
- Include `requestId` and `inputVersion`.
- Never include sensitive user credentials or raw CV content.

## Model Output Validation

Backend validates response schema and business constraints:

- `recommendations[].jobId` must exist in backend-sent candidate list.
- `jobId` must be unique within one response.
- Invalid/unknown/duplicate `jobId` returns `502 MODEL_RESPONSE_INVALID`.
- Service downtime maps to `503 MODEL_SERVICE_UNAVAILABLE`.

## Response Shape

Successful response envelope:

```json
{
  "success": true,
  "message": "Rekomendasi pekerjaan berhasil dibuat",
  "data": {
    "recommendationRun": {
      "id": "11111111-1111-4111-8111-111111111111",
      "cvAnalysisResultId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "generatedAt": "2026-05-18T10:00:00.000Z",
      "modelName": "job-recommendations-model",
      "modelVersion": "v1",
      "candidateCount": 24,
      "recommendationCount": 10
    },
    "recommendations": [
      {
        "job": {
          "id": "11111111-1111-4111-8111-111111111111",
          "title": "Backend Developer",
          "companyName": "Nusantara Tech",
          "location": "Jakarta Selatan, DKI Jakarta",
          "workType": "REMOTE",
          "experienceLevel": "ENTRY_LEVEL"
        },
        "matchScore": 86,
        "matchLevel": "strong",
        "reasons": ["Kecocokan skill backend utama sudah kuat."],
        "matchedSkills": ["TypeScript", "PostgreSQL"],
        "missingSkills": ["Docker"],
        "nextSteps": ["Tambahkan pengalaman deployment di CV."],
        "isBookmarked": false,
        "hasApplied": false
      }
    ]
  },
  "meta": null
}
```

## Persistence

Recommendation snapshots are stored in:

- `job_recommendation_runs`
- `job_recommendation_items`

Snapshot metadata:

- `user_id`
- `cv_analysis_result_id`
- optional `idempotency_key`
- model name/version
- candidate and recommendation counts
- backend input summary and filters snapshot
- ranked recommendation items

`idempotencyKey` reuses existing run when `(userId, idempotencyKey)` already exists.

## Error Contract

| Scenario                                 | Status | Code                           |
| ---------------------------------------- | ------ | ------------------------------ |
| Unauthenticated request                  | 401    | `UNAUTHENTICATED`              |
| Explicit analysis id not found/not owned | 404    | `CV_ANALYSIS_RESULT_NOT_FOUND` |
| No fallback analysis exists              | 422    | `CV_ANALYSIS_REQUIRED`         |
| Recommendation run not found/not owned   | 404    | `JOB_RECOMMENDATION_NOT_FOUND` |
| Model service unavailable                | 503    | `MODEL_SERVICE_UNAVAILABLE`    |
| Model response invalid                   | 502    | `MODEL_RESPONSE_INVALID`       |

## Test Coverage

Minimum coverage for this module:

- Schema validation tests.
- Service tests for idempotency, fallback analysis, and model output rejection.
- Route tests for auth, success, concealment, and model failure mapping.
- Repository integration tests for run/item persistence and ownership-resolved CV lookup.

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/modules/jobs.md`
- `docs/integrations/model-api.md`
- `docs/database.md`
- `docs/api-reference.md`
