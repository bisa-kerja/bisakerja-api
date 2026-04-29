---
title: Model API Integration
description: FastAPI inference boundary, backend-owned payloads, response expectations, timeout, retry, fallback, and error mapping for Model API integration.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/integrations/model-api.md
last_reviewed: 2026-04-29
---

# Model API Integration

The Model API is the inference-serving boundary for Bisakerja AI workflows. It receives backend-prepared payloads and returns derived outputs such as fit score, explanation breakdown, skill gap, recommendation, and CV analysis.

The Backend API owns user authorization, data loading, payload preparation, response validation, frontend response formatting, and optional persistence of AI result snapshots. The Model API does not own transactional application state.

## Integration Boundary

| Area                                    | Owner       |
| --------------------------------------- | ----------- |
| User authentication and authorization   | Backend API |
| User profile and preference loading     | Backend API |
| Job context loading                     | Backend API |
| CV file validation and ownership checks | Backend API |
| Inference payload assembly              | Backend API |
| Model execution                         | Model API   |
| Fit score and explanation generation    | Model API   |
| Skill gap and recommendation generation | Model API   |
| CV analysis output generation           | Model API   |
| Product-safe response mapping           | Backend API |
| AI result snapshot persistence          | Backend API |

Frontend UI must never call Model API directly.

## Runtime Assumption

The project plan references FastAPI for inference serving. Backend API should treat Model API as an internal HTTP dependency reachable through `MODEL_API_BASE_URL`.

Expected environment variables:

- `MODEL_API_BASE_URL`
- `MODEL_API_TIMEOUT_MS`
- `MODEL_API_SERVICE_TOKEN`
- `MODEL_API_ENABLE_MOCK` for local-only development before the real service is available

Current backend default endpoint assumptions:

- `POST /job-fit`
- `POST /cv-analyzer`

These paths are treated as the current internal contract until the Model API publishes a final route inventory.

## Supported Workflows

| Workflow           | Backend module   | Model output                                                                                                               |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Job fit analysis   | `ai-job-fit`     | Fit score, explanation breakdown, skill match, experience match, preference match, skill gaps, recommendation              |
| Skill gap analysis | `ai-job-fit`     | Missing skills, priority, reason, and improvement direction                                                                |
| AI CV Analyzer     | `ai-cv-analyzer` | Overall impression, job fit alignment, ATS score, keyword optimization, experience quantification, actionable improvements |

## Request Ownership

Backend API prepares every Model API payload from persisted or validated data.

Rules:

- Do not trust frontend-supplied profile, preference, skill, experience, or job context.
- Load user context from PostgreSQL through Backend API repositories.
- Load job context from normalized job records.
- Send only fields needed for inference.
- Include `requestId` for traceability.
- Include model input version when the Model API requires it.
- Exclude passwords, tokens, OTP values, service credentials, and unrelated personal data.

## Job Fit Payload Contract

Backend-prepared payload shape:

```json
{
  "requestId": "req_123",
  "inputVersion": "job-fit-v1",
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
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Backend Developer",
    "description": "Build backend APIs.",
    "requirements": [
      {
        "type": "SKILL",
        "value": "TypeScript",
        "priority": "HIGH"
      }
    ],
    "skills": ["TypeScript", "PostgreSQL"],
    "workType": "REMOTE",
    "experienceLevel": "ENTRY_LEVEL"
  }
}
```

## Job Fit Response Expectations

Model API should return enough structured output for Backend API to produce:

- `fitScore`: integer `0` to `100`.
- `readinessLevel`: supported readiness enum.
- `recommendation.decision`: supported recommendation enum.
- `recommendation.summary`.
- `recommendation.nextSteps`.
- `recommendation.successProbability` if model supports it.
- `breakdown.skillMatch`.
- `breakdown.experienceMatch`.
- `breakdown.preferenceMatch`.
- `skillGaps`.
- `model.name`.
- `model.version`.

Backend API must validate this response with Zod before returning it to frontend.

## CV Analyzer Payload Contract

Backend-prepared payload shape:

```json
{
  "requestId": "req_456",
  "inputVersion": "cv-analyzer-v1",
  "language": "ID",
  "inputMode": "UPLOAD",
  "compareSource": "JOB_SEARCH",
  "cv": {
    "fileId": "cv_file_123",
    "mimeType": "application/pdf",
    "sizeBytes": 524288,
    "storageKey": "cv/user_123/cv_file_123.pdf"
  },
  "job": {
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Backend Developer",
    "description": "Build backend APIs.",
    "requirements": [
      {
        "type": "SKILL",
        "value": "TypeScript",
        "priority": "HIGH"
      }
    ],
    "skills": ["TypeScript", "PostgreSQL"]
  }
}
```

Rules:

- Backend may send file reference, extracted text, or both depending on final Model API agreement.
- If extracted text is sent, backend must not store it unless privacy and retention policy allow it.
- Model API response must be validated before frontend mapping.
- Backend should send normalized internal enum values to Model API, such as `ID` and `EN` for analysis language.

## CV Analyzer Response Expectations

Model API should return enough structured output for Backend API to produce:

- Overall impression score and summary.
- Job fit alignment score, matched signals, missing signals, and summary.
- ATS friendliness score and issues.
- Keyword recommendations and reason.
- Experience quantification score and suggestions.
- Actionable improvements.
- Model name and version.

Generated CV output is future scope unless explicitly approved.

## Timeout Policy

Default timeout:

```text
MODEL_API_TIMEOUT_MS=10000
```

Rules:

- Timeout applies per Model API request.
- Timeout should return `503 SERVICE_UNAVAILABLE` to frontend.
- Timeout should not break non-AI routes.
- Timeout events should be logged with request id and dependency latency.

## Retry Policy

MVP retry direction:

- Do not retry unsafe or expensive inference calls by default.
- Allow one retry only for clearly transient connection failures if latency budget allows.
- Do not retry validation failures.
- Do not retry invalid model responses.
- Do not retry file upload or CV extraction failures without idempotency guarantees.

If retries are implemented, log retry count and final result.

## Fallback Policy

Allowed fallback:

- Return clear AI unavailable error when Model API is down.
- Use `MODEL_API_ENABLE_MOCK=true` only for local development and tests.
- Keep search, job detail, bookmarks, applications, profile, and preferences working without Model API.

Not allowed:

- Return fake production scores.
- Reuse stale AI result as if it were fresh without explicit `cached` metadata.
- Expose raw model error details to frontend.

## Error Mapping

| Model integration failure                    | Backend status | Error code            | Notes                                             |
| -------------------------------------------- | -------------- | --------------------- | ------------------------------------------------- |
| Connection refused                           | 503            | `SERVICE_UNAVAILABLE` | Model API unavailable                             |
| Timeout                                      | 503            | `SERVICE_UNAVAILABLE` | Inference timed out                               |
| 5xx from Model API                           | 503            | `SERVICE_UNAVAILABLE` | Treat as dependency failure                       |
| 4xx from Model API caused by backend payload | 502            | `DOWNSTREAM_ERROR`    | Backend/model contract mismatch                   |
| Invalid response schema                      | 502            | `DOWNSTREAM_ERROR`    | Do not trust output                               |
| Missing model version                        | 502            | `DOWNSTREAM_ERROR`    | Required metadata missing if contract requires it |
| Unsupported model endpoint                   | 502            | `DOWNSTREAM_ERROR`    | Contract/config mismatch                          |

Frontend error response must follow `docs/api-response-standard.md`.

## Failure Scenarios

### Model Unavailable

Symptoms:

- Job search and tracker still work.
- AI job fit and CV analyzer fail.

Backend behavior:

- Return `503 SERVICE_UNAVAILABLE`.
- Include `dependency: model-api` in safe error details.
- Log request id and timeout/connectivity context.
- Do not call Model API from frontend.

First checks:

- Confirm `MODEL_API_BASE_URL`.
- Confirm Model API health.
- Confirm service credential.
- Confirm network route.

### Invalid Model Response

Symptoms:

- Model API responds, but backend cannot validate score, enum, or required fields.

Backend behavior:

- Return `502 DOWNSTREAM_ERROR`.
- Log sanitized schema mismatch summary.
- Do not persist invalid AI result.
- Do not expose raw model payload.

First checks:

- Compare backend Zod response schema with Model API output.
- Confirm model version.
- Confirm recent Model API deploy changes.

### Payload Contract Drift

Symptoms:

- Model API rejects backend request.
- Fit score or CV analyzer fails after profile, job, or model schema changes.

Backend behavior:

- Return `502 DOWNSTREAM_ERROR` if backend sent payload incompatible with Model API.
- Log input version and endpoint.
- Do not fallback to fake output.

First checks:

- Compare payload version.
- Confirm required fields from `UserProfile`, `UserPreference`, and `JobListing`.
- Confirm Model API endpoint contract.

### Database Connectivity Issue Before Model Call

Symptoms:

- Backend cannot load profile, preferences, job, or CV metadata.

Backend behavior:

- Return `503 SERVICE_UNAVAILABLE`.
- Do not call Model API.
- Keep readiness degraded.

First checks:

- Confirm PostgreSQL and Prisma connectivity.
- Confirm recent migrations.
- Confirm affected query path.

## Observability

Backend API should log:

- `model_api.request_started`
- `model_api.request_completed`
- `model_api.request_failed`
- `model_api.response_invalid`
- `model_api.timeout`

Recommended log fields:

- `requestId`
- `userId`
- `jobId`
- `workflow`
- `modelEndpoint`
- `modelVersion`
- `inputVersion`
- `latencyMs`
- `retryCount`
- `result`

Do not log raw CV text, full model payloads, tokens, service credentials, or raw model internals.

## Test Scenarios

Unit tests:

- Payload builder excludes sensitive fields.
- Response validator rejects invalid scores and unsupported enums.
- Timeout maps to `503`.
- Invalid response maps to `502`.
- Mock mode cannot be enabled in production config.

Integration tests:

- AI Job Fit calls Model API with backend-prepared payload.
- AI CV Analyzer calls Model API with validated CV metadata.
- Model timeout returns standard error envelope.
- Model invalid response is not persisted.
- Model unavailable does not break Jobs, Bookmarks, or Applications routes.

Contract tests:

- Backend payload schema matches Model API expected request.
- Backend response schema matches Model API expected response.
- Model version metadata is handled consistently.

## Related Docs

- `docs/integrations/scraper-api.md`
- `docs/integrations/job-sources.md`
- `docs/modules/ai-job-fit.md`
- `docs/modules/ai-cv-analyzer.md`
- `docs/api-response-standard.md`
- `docs/environment.md`
- `references/docs/overview/asynchronous-workflows.mdx`
- `references/docs/operations/failure-scenarios.mdx`
