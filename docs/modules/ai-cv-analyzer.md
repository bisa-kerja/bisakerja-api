---
title: AI CV Analyzer Module
description: CV upload, language selection, target role comparison, ATS friendliness, job fit alignment, dynamic section reviews, actionable feedback, privacy, and retention contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-cv-analyzer.md
last_reviewed: 2026-05-22
---

# AI CV Analyzer Module

The AI CV Analyzer module analyzes a user's CV against one or more target job roles. It validates CV input, stores reusable CV metadata when requested, calls Model API, returns product-safe analysis output, and optionally stores sanitized analysis snapshots.

Generated improved CV output remains outside the current contract.

## Responsibility

The AI CV Analyzer module owns:

- CV upload or CV reference input contract.
- Output language selection.
- Selected job comparison.
- Overall CV impression.
- Job fit alignment.
- ATS friendliness score and summary.
- Top actionable improvements.
- Dynamic section reviews based on detected CV sections.
- Generated CV availability note.
- CV privacy and retention rules.
- Downstream Model API failure mapping.

The AI CV Analyzer module does not own:

- General profile photo uploads.
- Long-term file storage strategy outside documented retention.
- Resume builder or generated CV document editing in MVP.
- Model training or model artifact management.
- Raw CV content exposure to frontend logs or backend logs.

## Route Prefixes

```text
/api/v1/ai/cv-analyzer
/api/v1/me/cv-files
```

## Endpoint Summary

| Method | Path                                               | Auth                                     | Purpose                                                    |
| ------ | -------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `POST` | `/api/v1/me/cv-files`                              | Authenticated or onboarding access token | Upload a current user's reusable PDF CV                    |
| `GET`  | `/api/v1/me/cv-files/active`                       | Authenticated or onboarding access token | Read the current user's active CV metadata                 |
| `POST` | `/api/v1/ai/cv-analyzer`                           | Authenticated                            | Analyze uploaded or stored PDF CV against target job roles |
| `GET`  | `/api/v1/ai/cv-analyzer/results`                   | Authenticated and ownership-protected    | List current user's stored CV analysis results             |
| `GET`  | `/api/v1/ai/cv-analyzer/results/latest`            | Authenticated and ownership-protected    | Read current user's latest stored CV analysis result       |
| `GET`  | `/api/v1/ai/cv-analyzer/results/:analysisResultId` | Authenticated and ownership-protected    | Read one stored CV analysis result owned by current user   |

Generated CV download requires separate documentation.

## Auth And Ownership Rules

- Route requires authenticated user identity.
- Current-user CV upload and active CV lookup may be used before email verification so onboarding can save an optional CV.
- If the CV is referenced by stored file id, the file metadata must belong to current user.
- Cross-user CV references are concealed as `404 CV_FILE_NOT_FOUND`.
- Request body must not include trusted profile or preference data.
- Backend must not log raw CV content.

## Input Modes

MVP supports one of these modes:

| Mode        | Description                                        |
| ----------- | -------------------------------------------------- |
| `UPLOAD`    | User uploads a PDF CV file in the analyzer request |
| `REFERENCE` | User references a previously uploaded CV file      |

Analyzer CV source priority:

1. A new `cvFile` upload in the analyzer request.
2. An explicit `cvFileId` owned by the current user.
3. The current user's active CV file.

If no upload, no valid `cvFileId`, and no active CV are available, the analyzer returns `422 VALIDATION_ERROR`.

## Current-User CV Upload

`POST /api/v1/me/cv-files` accepts `multipart/form-data`.

Multipart fields:

| Field         | Rule                                                      |
| ------------- | --------------------------------------------------------- |
| `cvFile`      | Required PDF file using the configured CV upload limits   |
| `setAsActive` | Optional boolean string `true` or `false`, default `true` |

Successful response:

```json
{
  "success": true,
  "message": "CV uploaded successfully",
  "data": {
    "cvFile": {
      "id": "11111111-1111-4111-8111-111111111111",
      "originalFileName": "resume.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 284321,
      "uploadedAt": "2026-05-18T10:00:00.000Z",
      "expiresAt": "2026-05-19T10:00:00.000Z",
      "isActive": true
    }
  },
  "meta": null
}
```

`GET /api/v1/me/cv-files/active` returns envelope shape `{ "cvFile": ... }` with the same safe metadata fields. It does not expose `storageKey`.

## Request Schema

For multipart upload, metadata fields are sent alongside file part.

```json
{
  "jobRoles": ["Backend Developer", "Software Engineer"],
  "language": "id",
  "inputMode": "UPLOAD",
  "compareSource": "JOB_SEARCH",
  "persistResult": true
}
```

Validation:

| Field           | Rule                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| `jobRoles`      | Required target role list, 1-10 items                                              |
| `language`      | Required enum: `id` or `en`                                                        |
| `inputMode`     | Required enum: `UPLOAD` or `REFERENCE`                                             |
| `compareSource` | Optional enum: `BOOKMARK`, `JOB_SEARCH`, `DIRECT_JOB_DETAIL`; default `JOB_SEARCH` |
| `persistResult` | Optional boolean, default `true`; send `false` only to opt out of saving           |
| `cvFile`        | Required for `UPLOAD` mode                                                         |
| `cvFileId`      | Optional for `REFERENCE`; when omitted the active CV fallback is used              |

CV file validation:

| Rule              | Default                                                      |
| ----------------- | ------------------------------------------------------------ |
| Maximum file size | `CV_UPLOAD_MAX_BYTES`, default 5 MB                          |
| Allowed mime type | `application/pdf` for MVP                                    |
| Retention         | `CV_RETENTION_DAYS`, default 1 day for MVP temporary uploads |

## Backend-Prepared Model Payload

Backend calls Model API through the internal multipart contract:

```text
POST /internal/model/cv-analysis
content-type: multipart/form-data
```

Multipart fields:

| Field           | Rule                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `requestId`     | Required trace id from Backend request context.                                                                       |
| `language`      | `id` or `en`; Backend maps to Prisma `ID`/`EN` only at persistence boundary.                                          |
| `inputMode`     | `UPLOAD` or `REFERENCE`.                                                                                              |
| `compareSource` | `BOOKMARK`, `JOB_SEARCH`, or `DIRECT_JOB_DETAIL`.                                                                     |
| `jobRoles[]`    | Target roles selected for analysis.                                                                                   |
| `cvFile`        | One PDF file part. For `REFERENCE`, Backend resolves and streams owned active/selected CV bytess.                     |
| `jobCandidates` | JSON array of Backend-selected jobs with unique `jobId` and model-owned `scoringInput`.                               |
| `rankingPolicy` | JSON object requiring candidate membership, deduplication, Backend hydration ownership, and max five recommendations. |

Example `jobCandidates[]` item:

```json
{
  "jobId": "11111111-1111-4111-8111-111111111111",
  "scoringInput": {
    "titleText": "Backend Developer",
    "descriptionText": "Build REST APIs and PostgreSQL services.",
    "requirementSummary": "TypeScript, PostgreSQL, API testing.",
    "requiredSkills": ["typescript", "postgresql", "rest api"],
    "requirements": ["Build REST APIs", "Maintain PostgreSQL schema"],
    "roleFamily": "backend",
    "experienceLevel": "ENTRY_LEVEL",
    "workType": "REMOTE"
  },
  "backendMetadata": {
    "title": "Backend Developer",
    "companyName": "Nusantara Tech",
    "source": "JOB_SEARCH"
  }
}
```

Payload rules:

- Backend owns auth, file ownership, candidate retrieval, visibility/expiry filters, persistence, and final public response shape.
- Model API owns PDF parsing, CV evidence extraction, ATS signals, scoring, and candidate reranking only.
- Model API must not receive DB credentials, write backend data, hydrate jobs, decide auth/ownership, or generate final public wrapper fields.
- `backendMetadata` is trace/hydration context only; Model API must validate recommendation `jobId` membership from `jobCandidates`.
- Contract fixtures live in `artifacts/backend_model_api_contract/internal_contract_fixtures.json` and ownership matrix in `artifacts/backend_model_api_contract/openapi_prisma_owner_matrix.json`.

## Response Schema

```json
{
  "success": true,
  "message": "CV analysis completed successfully",
  "data": {
    "jobRoles": ["Backend Developer", "Software Engineer"],
    "language": "id",
    "analysisResult": {
      "id": "11111111-1111-4111-8111-111111111111",
      "schemaVersion": "cv-analysis-v2",
      "jobFitAlignment": {
        "score": 78,
        "summary": "The CV is well aligned with the Backend Developer role because it highlights REST API, PostgreSQL, and backend project experience. Fit can improve if deployment experience is made more explicit."
      },
      "atsFriendliness": {
        "score": 84,
        "summary": "The CV structure is easy enough for ATS to read, but several important keywords are not summarized clearly in the skills section."
      },
      "overallImpression": "The CV shows a strong backend foundation for a junior-mid candidate, with the largest improvement areas in impact evidence and keyword alignment for the target role.",
      "topActionables": [
        "Add 2-3 measurable bullets to backend experience, such as performance improvement, user count, or data scale.",
        "Create a technical skills section that groups programming languages, databases, frameworks, and deployment tools.",
        "Align the profile summary with the Backend Developer role so key keywords appear near the top of the CV."
      ],
      "sectionReviews": [
        {
          "sectionName": "Relevant Skills",
          "analysis": "Relevant backend skills are present, but not all are grouped clearly.",
          "actionPoints": [
            "Group skills into Backend, Database, Testing, and Deployment.",
            "Prioritize skills most often requested for the target role."
          ],
          "whyItsImportantForYou": "ATS and recruiters usually look for specific skill keywords before reading experience details."
        }
      ],
      "jobRecommendations": [
        {
          "jobId": "11111111-1111-4111-8111-111111111111",
          "title": "Backend Developer",
          "companyName": "Nusantara Tech",
          "matchScore": 82,
          "reason": "This job matches TypeScript, REST API, and PostgreSQL signals in the CV.",
          "nextStep": "Clarify deployment evidence before sending an application."
        }
      ],
      "generatedCv": {
        "available": false,
        "note": "Generated CV feature is not available yet."
      },
      "model": {
        "name": "cv-analyzer-model",
        "version": "v1"
      },
      "analyzedAt": "2026-04-22T00:00:00.000Z"
    }
  },
  "meta": null
}
```

Response rules:

- `analysisResult.schemaVersion` must be `cv-analysis-v2` for this contract.
- `jobFitAlignment.score` and `atsFriendliness.score` are integer `0-100` values.
- `overallImpression` must be concise user-facing text.
- `topActionables` must contain `1-3` items.
- `sectionReviews` is dynamic; sections that are not found must not be forced into the response.
- `sectionReviews[].actionPoints` must contain at least one item.
- `jobRecommendations` contains compact recommendations from the current CV analysis result, maximum 5 items.
- Job recommendation items only contain `jobId`, `title`, `companyName`, `matchScore`, `reason`, and `nextStep`.
- Do not return raw Model API internals.
- Do not return raw full CV text by default.
- Keep generated CV explicitly unavailable in current contract.

## Wrapper Prompt And Fallback Safety

The public prose wrapper uses an allowlisted input only. Allowed fields are request id, requested language, job roles, compare source, input mode, model-core evidence, shared sanitized CV evidence, detected sections, and compact hydrated candidate metadata. Raw CV text, file bytes, storage identifiers, tokens, DB URLs, emails, phones, addresses, auth headers, and full Model API payloads are excluded from wrapper input.

Analyzer wrapper uses the shared CV evidence schema `shared-cv-evidence-v1`. After Model API inference, Backend converts parser, ATS, skill, requirement, model version, and candidate evidence into a `model_api` shared evidence object. The object includes parser confidence, source hash, cache key, invalidation policy, retention policy, bounded section evidence, skill/requirement coverage, ATS evidence, confidence flags, and no-retention privacy booleans. The wrapper provider receives only this sanitized schema plus model-owned evidence and candidate metadata.

Deterministic Backend fallback remains the default. Optional provider-generated copy is controlled by `AI_CV_ANALYZER_GENAI_ENABLED` and uses an OpenAI-compatible chat-completions provider such as OpenRouter. The provider request uses the backend-owned injection-resistant system prompt, JSON-only response mode, configured timeout, sanitized request-id logging, and no retry by default.

Current staging returns English copy by default, including when `language=id` is requested. Generated wrapper output must pass strict JSON validation before persistence or frontend response. It must preserve model scores, model metadata, candidate ids, recommendation order, recommendation count, recommendation scores, and analysis timestamp exactly. Invalid or unsafe generated output is replaced by deterministic fallback copy without failing successful model-core inference.

Safety filters reject or remove copy that exposes prompts, system/developer messages, secrets, tokens, PII-like contact/address data, unsupported companies/jobs, prompt-injection text, protected-class claims, guaranteed hiring outcomes, or invented evidence. Provider timeout, malformed JSON, markdown output, schema drift, score mutation, candidate mutation, and safety rejection all fall back to deterministic copy.

## Stored Analysis Results

Stored result endpoints read sanitized snapshots from `cv_analysis_results`. They do not call Model API and do not re-run analysis.

List query supports:

| Field           | Rule                                                      |
| --------------- | --------------------------------------------------------- |
| `page`          | integer, default `1`, minimum `1`                         |
| `limit`         | integer, default `10`, maximum `50`                       |
| `sortBy`        | only `analyzedAt`                                         |
| `sortOrder`     | `desc` default, or `asc`                                  |
| `cvFileId`      | optional UUID filter                                      |
| `schemaVersion` | optional stored schema version filter                     |
| `inputMode`     | optional `UPLOAD` or `REFERENCE`                          |
| `compareSource` | optional `BOOKMARK`, `JOB_SEARCH`, or `DIRECT_JOB_DETAIL` |

List response follows existing paginated endpoint pattern: `data` is an array and `meta.pagination` contains pagination metadata. Each item contains safe summary fields only: id, schema version, analysis time, input mode, compare source, score-only job fit and ATS summaries, overall impression preview, up to three actionables, safe model metadata, and safe CV file metadata when available.

Detail and latest response use `{ analysisResult, context }`. `analysisResult` follows the stored CV analysis schema, including job fit alignment, ATS friendliness, overall impression, actionables, section reviews, job recommendations, generated CV availability note, model metadata, and analyzed time. `context` contains safe language/input metadata, safe CV file metadata, and a redacted input summary.

Privacy rules:

- Results are always scoped by current `userId` in repository queries.
- Cross-user ids are concealed as `404 CV_ANALYSIS_RESULT_NOT_FOUND`.
- `latest` route is registered before `:analysisResultId` to avoid route-param collision.
- Responses never expose raw CV text, storage key, prompt, tokens, email, phone, address, or full Model API payload.
- Deleted or expired CV file metadata is returned as `null`.
- Unsupported legacy snapshots should fail closed with `409 CV_ANALYSIS_RESULT_UNSUPPORTED` when compatibility adapters are introduced.

## Service Logic

1. Require authenticated identity.
2. Validate metadata fields and upload/reference mode.
3. Validate target `jobRoles`.
4. Validate CV file or referenced CV metadata ownership.
5. Store CV file or temporary metadata according to retention policy.
6. Build backend-prepared Model API payload.
7. Call Model API with timeout and request id.
8. Validate Model API response with Zod.
9. Build `model_api` shared CV evidence and safe observability metadata.
10. Build allowlisted wrapper input.
11. If `AI_CV_ANALYZER_GENAI_ENABLED=true`, call the configured GenAI provider for JSON-only public copy.
12. Validate generated copy against schema, safety filters, and model-owned invariants; fall back deterministically on failure.
13. Optionally persist `CvAnalysisResult` snapshot and sanitized file metadata.
14. Return standard success envelope.

## Repository And Database Usage

Read models:

- `User`
- `JobListing`
- `JobRequirement`
- `JobSkill`
- `Bookmark` when `compareSource` is `BOOKMARK`

Optional write models:

- `CvAnalysisResult`
- CV file metadata model if implemented
- `AiRequestLog`

Persistence rules:

- Persist sanitized analysis snapshots by default; `persistResult=false` opts out.
- Store CV file metadata separately from raw analysis result.
- `cv_file_metadata.isActive` marks the user's active CV.
- At most one non-deleted active CV may exist per user.
- Store `expiresAt` for uploaded CV files.
- Store `deletedAt` after deletion.
- Store shared CV evidence only as bounded sanitized structured evidence when caching is enabled.
- Do not store raw extracted CV text unless explicit retention policy is approved.
- Do not let Model API write directly to database.

## Privacy And Retention

CV files are sensitive user data.

Rules:

- Enforce file size and mime type before Model API call.
- Store only what is needed for analysis.
- Follow `CV_RETENTION_DAYS`, default 1 day.
- Store temporary files in a private local upload path, not a public static directory.
- Delete expired files through the manual cleanup command `bun run cleanup:cv-uploads` or an equivalent scheduled workflow.
- Redact raw CV content from logs.
- Never include raw CV text in error responses.
- Do not expose storage keys directly if they reveal internal infrastructure.

Suggested metadata:

- `userId`
- `originalFileName`
- `mimeType`
- `sizeBytes`
- `storageDriver`
- `storageKey`
- `isActive`
- `uploadedAt`
- `expiresAt`
- `deletedAt`

## Downstream Failure Behavior

| Failure                                    | Status     | Error code                                       | Behavior                            |
| ------------------------------------------ | ---------- | ------------------------------------------------ | ----------------------------------- |
| Invalid file type                          | 422        | `VALIDATION_ERROR`                               | Reject before storage or model call |
| File too large                             | 413        | `PAYLOAD_TOO_LARGE`                              | Reject before storage or model call |
| Job not found                              | 404        | `JOB_NOT_FOUND`                                  | No model call                       |
| Bookmark not owned                         | 404        | `BOOKMARK_NOT_FOUND`                             | Hide ownership details              |
| No active job search candidates            | 422        | `VALIDATION_ERROR`                               | No model call                       |
| Model API timeout                          | 503        | `SERVICE_UNAVAILABLE`                            | Return safe AI unavailable error    |
| Model API invalid response                 | 502        | `DOWNSTREAM_ERROR`                               | Reject untrusted output             |
| GenAI provider timeout                     | 200        | None                                             | Use deterministic fallback copy     |
| GenAI provider invalid JSON or unsafe copy | 200        | None                                             | Use deterministic fallback copy     |
| Storage unavailable                        | 500 or 503 | `INTERNAL_SERVER_ERROR` or `SERVICE_UNAVAILABLE` | Do not call model                   |

## Error Cases

| Case                                | Status     | Error code                                       |
| ----------------------------------- | ---------- | ------------------------------------------------ |
| Missing auth                        | 401        | `UNAUTHENTICATED`                                |
| Invalid request body                | 422        | `VALIDATION_ERROR`                               |
| Invalid language                    | 422        | `VALIDATION_ERROR`                               |
| Invalid CV file                     | 422        | `VALIDATION_ERROR`                               |
| CV file too large                   | 413        | `PAYLOAD_TOO_LARGE`                              |
| Job not found                       | 404        | `JOB_NOT_FOUND`                                  |
| Referenced CV not owned             | 404        | `CV_FILE_NOT_FOUND`                              |
| Referenced CV not found             | 404        | `CV_FILE_NOT_FOUND`                              |
| No active CV fallback               | 422        | `VALIDATION_ERROR`                               |
| Bookmark not found for current user | 404        | `BOOKMARK_NOT_FOUND`                             |
| No active job search candidates     | 422        | `VALIDATION_ERROR`                               |
| Storage unavailable                 | 500 or 503 | `INTERNAL_SERVER_ERROR` or `SERVICE_UNAVAILABLE` |
| Model unavailable                   | 503        | `SERVICE_UNAVAILABLE`                            |
| Model invalid response              | 502        | `DOWNSTREAM_ERROR`                               |

Validation detail examples for `422 VALIDATION_ERROR`:

- `body`: `Request must use multipart/form-data`
- `cvFile`: `CV file type is not supported. Use application/pdf`
- `cvFile`: `PDF CV file is required for analysis`
- `cvFileId`: `Upload a CV or send a valid CV file ID`

## Observability

Log safe structured events:

- `ai_cv_analyzer.requested`
- `ai_cv_analyzer.completed`
- `ai_cv_analyzer.failed`
- `ai_cv_analyzer.persisted`
- shared evidence source, parser confidence, cache status, wrapper fallback reason, and no-leak check booleans

Include:

- `requestId`
- `userId`
- `jobRoles`
- `language`
- `inputMode`
- `fileSizeBytes`
- `mimeType`
- `modelVersion` when available
- dependency latency
- result

Do not log original CV content, extracted full text, tokens, storage identifiers, provider payloads, or prompt content.

## Test Scenarios

Unit tests:

- Metadata schema rejects unsupported language.
- Upload mode requires file.
- Reference mode returns `422` until reusable storage is enabled.
- File validator rejects unsupported mime type.
- File validator rejects files larger than `CV_UPLOAD_MAX_BYTES`.
- Response schema enforces score range `0` to `100`.
- Mapper marks generated CV as unavailable in MVP.
- Cleanup helper deletes expired files and marks metadata with `deletedAt`.

Integration tests:

- Authenticated user can analyze valid PDF against an existing job.
- Missing auth returns `401`.
- Missing job returns `404`.
- Bookmark compare source requires owned bookmark.
- Invalid file type returns `422`.
- Model timeout returns `503`.
- Model invalid response returns `502`.
- Persist enabled stores sanitized `CvAnalysisResult` and file metadata.

Route tests:

- Response follows `docs/api-response-standard.md`.
- Multipart metadata is validated.
- Raw CV content is not present in response.
- Raw model internals are not present in response.

## Deferred Decisions

- Scheduled cleanup automation beyond the manual command.
- Exact Model API endpoint and payload format.
- Whether generated CV remains future scope.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/database.md`
- `docs/environment.md`
- `docs/modules/jobs.md`
- `docs/modules/bookmarks.md`
- `docs/modules/ai-job-fit.md`
- `docs/modules/ai-cv-generate.md`
- `docs/modules/shared-cv-evidence.md`
