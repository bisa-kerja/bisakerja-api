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

Final CV Analyzer endpoint:

```text
POST /internal/model/cv-analysis
content-type: multipart/form-data
```

Legacy JSON-only inference paths remain local/test compatibility only. Production CV analysis uses Backend-as-orchestrator: Backend resolves auth, file ownership, candidate retrieval, DB hydration, persistence, and public `cv-analysis-v2` formatting; Model API parses PDF bytes and returns model-core evidence and rankings.

Durable contract fixtures and owner matrix live in:

- `artifacts/backend_model_api_contract/internal_contract_fixtures.json`
- `artifacts/backend_model_api_contract/openapi_prisma_owner_matrix.json`

## Internal CV Analysis Request Contract

Backend sends multipart fields:

| Field           | Owner               | Rule                                                                                                                          |
| --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `requestId`     | Backend             | Required trace/idempotency correlation id.                                                                                    |
| `language`      | Backend             | Public/model enum `id` or `en`; Backend maps Prisma `ID`/`EN`.                                                                |
| `inputMode`     | Backend             | `UPLOAD` or `REFERENCE`; ownership checked before request.                                                                    |
| `compareSource` | Backend             | `BOOKMARK`, `JOB_SEARCH`, or `DIRECT_JOB_DETAIL`.                                                                             |
| `jobRoles[]`    | Backend             | Target roles selected from request/backend workflow.                                                                          |
| `directJobId`   | Backend             | Required only for `DIRECT_JOB_DETAIL`; Backend validates job visibility before Model API call.                                |
| `cvFile`        | Backend → Model API | One PDF file part; upload bytes or ownership-checked reference bytes; Model API validates content type, parseability, limits. |
| `jobCandidates` | Backend             | JSON array of backend-selected candidates; max 50, unique `jobId`.                                                            |
| `rankingPolicy` | Backend             | JSON object; `backendOwnsHydration=true`, `requireCandidateJobIds=true`, `deduplicateByJobId=true`, `maxRecommendations<=5`.  |

`jobCandidates[].scoringInput` contains model-owned evidence only: `titleText`, `descriptionText`, `requirementSummary`, `requiredSkills`, `requirements`, `roleFamily`, `experienceLevel`, `workType`, and optional numeric signals. `jobCandidates[].backendMetadata` may carry trace/hydration hints but Model API must not trust it for candidate identity beyond `jobId` membership.

## Internal CV Analysis Response Contract

Model API returns `model-core-cv-analysis-v1`:

| Field                                  | Owner     | Rule                                                                                                              |
| -------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `parsedCv`                             | Model API | Parse status, page count, text length, detected sections, extraction evidence.                                    |
| `jobFitAlignment`                      | Model API | Integer score `0-100`, matched/missing signals, matched/missing skills, evidence.                                 |
| `atsFriendliness`                      | Model API | Integer score `0-100`, detected issues, parse quality, evidence.                                                  |
| `overallImpression`                    | Model API | Score/evidence only; Backend wrapper creates final prose.                                                         |
| `candidateReranking.recommendations[]` | Model API | Supplied `jobId` only, `matchScore` `0-100`, `matchLevel` `strong/good/stretch`, evidence arrays, max five items. |
| `model`                                | Model API | Model name, version, and artifact identity.                                                                       |
| `createdAt`                            | Model API | ISO timestamp.                                                                                                    |

Forbidden in model-core output: `title`, `companyName`, `reason`, `nextStep`, `topActionables`, `sectionReviews`, `generatedCv`, auth fields, persistence fields, DB credentials, raw hydrated DB objects, and final public `jobRecommendations`.

## OpenAPI/Prisma Ownership Mapping

| Entity                      | Backend-owned                                                                                                             | Model-owned                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CvAnalysis.analysisResult` | `id`, `schemaVersion`, prose summaries, `topActionables`, `sectionReviews`, hydrated recommendation fields, `generatedCv` | Scores, evidence, candidate IDs, model recommendation order.                            |
| `CvAnalysisResult`          | User/file/job ids, language/input/compare enums, public snapshot, persistence timestamps                                  | Model score/evidence JSON and model identity.                                           |
| `JobRecommendationRun`      | User, result link, idempotency, candidate counts, status, filters, timestamps                                             | Model name/version and validated candidate-reranking schema.                            |
| `JobRecommendationItem`     | Job listing id, rank, DB relation, grounded prose reasons/next steps                                                      | `matchScore`, `matchLevel`, matched/missing skills.                                     |
| `JobListing`                | Source, company, title, description, location, visibility/status, expiry, DB hydration                                    | Scoring text/features derived by Backend; response may reference only supplied `jobId`. |
| `JobRequirement`            | Persisted requirement type/value/priority/order                                                                           | Requirement text/features and coverage evidence.                                        |
| `JobSkill`                  | Persisted skill relation/confidence                                                                                       | Required/matched/missing skill evidence strings.                                        |

Enum mapping is frozen: public/model language `id/en` maps to Prisma `ID/EN`; model `strong/good/stretch` maps to Prisma `STRONG/GOOD/STRETCH`; input mode and compare source values are identical across public/model/Prisma boundaries.

## Backend Orchestration

`/api/v1/ai/cv-analyzer` resolves CV bytes before calling Model API. Direct uploads use request-scoped buffers; reference mode streams bytes from backend-owned CV storage after ownership, expiry, and path-traversal checks. Candidate retrieval stays in Backend:

- `BOOKMARK` uses active, non-expired jobs bookmarked by authenticated user.
- `JOB_SEARCH` searches visible, active jobs using requested role text.
- `DIRECT_JOB_DETAIL` uses one explicit visible, active job id.

Backend sends only model scoring fields to Model API. Public recommendation fields are hydrated from DB after Model API returns candidate ids and scores. GenAI prose is optional; deterministic fallback prose uses model evidence and DB job context without changing numeric scores, recommendation ids, or order.

## Failure Contract

| Model API outcome                                        | Backend behavior                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `422 contract_validation_error`                          | Return frontend validation/dependency error without persistence; log request id and validation path only.                                                                                                                            |
| `422 cv_parse_empty_text` or parse failure               | Return deterministic CV parse failure or low-confidence fallback policy; never fabricate CV text.                                                                                                                                    |
| `503 model_not_ready`, stale artifact, or loader failure | Return AI unavailable; do not retry validation failures.                                                                                                                                                                             |
| `504 inference_timeout`                                  | Return timeout/unavailable response; keep non-AI routes healthy.                                                                                                                                                                     |
| Empty candidate set                                      | Backend resolves before call. `DIRECT_JOB_DETAIL` returns `404 JOB_NOT_FOUND`, `BOOKMARK` returns ownership-safe `404 BOOKMARK_NOT_FOUND`, and `JOB_SEARCH` returns `422 VALIDATION_ERROR` instead of sending empty `jobCandidates`. |
| GenAI wrapper failure                                    | Backend keeps model scores/order and creates deterministic fallback prose from model-core evidence.                                                                                                                                  |

## Supported Workflows

| Workflow            | Backend module           | Model output                                                                                                                 |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Job fit analysis    | `ai-job-fit`             | Fit score, explanation breakdown, skill match, experience match, preference match, skill gaps, recommendation                |
| Skill gap analysis  | `ai-job-fit`             | Missing skills, priority, reason, and improvement direction                                                                  |
| AI CV Analyzer      | `ai-cv-analyzer`         | Overall impression, job fit alignment, ATS score, keyword optimization, experience quantification, actionable improvements   |
| AI CV Generate      | `ai-cv-generate`         | Final markdown HTML CV content generated from backend-owned CV reference, summary, and safe template input                   |
| Job recommendations | `ai-job-recommendations` | Ranked job recommendations selected from backend-provided candidate job IDs with match score, level, reasons, and next steps |

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

## Job Recommendation Payload Contract

Backend-prepared payload shape:

```json
{
  "requestId": "req_789",
  "inputVersion": "job-recommendations-v1",
  "talentProfile": {
    "targetRole": "Backend Developer",
    "seniorityLevel": "ENTRY_LEVEL",
    "hardSkills": ["TypeScript"],
    "softSkills": [],
    "domainSignals": ["Engineering"],
    "toolsAndTechnologies": ["REST API"],
    "educationSignals": [],
    "experienceYearsEstimate": null,
    "locationPreferences": [
      { "province": "DKI Jakarta", "city": "Jakarta Selatan" }
    ],
    "workTypePreferences": ["REMOTE"],
    "salaryExpectation": {
      "min": 5000000,
      "max": 9000000,
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
      "descriptionSummary": "Build backend APIs",
      "requiredSkills": ["TypeScript"],
      "postedAt": "2026-05-18T00:00:00.000Z",
      "sourceUpdatedAt": null
    }
  ]
}
```

Rules:

- Backend owns candidate retrieval and candidate list boundaries.
- Model must only rank candidate `jobId` values supplied by backend.
- Backend validates output and rejects unknown or duplicate `jobId`.

## Job Recommendation Response Expectations

Model API should return enough structured output for Backend API to produce:

- `recommendations[].jobId` from backend candidate set.
- `recommendations[].matchScore` in score range.
- `recommendations[].matchLevel` enum.
- `recommendations[].reasons`.
- `recommendations[].matchedSkills`.
- `recommendations[].missingSkills`.
- `recommendations[].nextSteps`.
- `model.name`.
- `model.version`.

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
