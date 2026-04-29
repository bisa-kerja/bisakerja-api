---
title: AI CV Analyzer Module
description: CV upload, language selection, selected job comparison, ATS score, keyword optimization, experience quantification, improvements, privacy, and retention contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-cv-analyzer.md
last_reviewed: 2026-04-29
---

# AI CV Analyzer Module

The AI CV Analyzer module analyzes a user's CV against a selected job listing. It validates CV input, loads normalized job context, calls Model API, returns product-safe analysis output, and optionally stores sanitized analysis snapshots.

This module is in MVP scope with temporary PDF `UPLOAD` mode only. `REFERENCE` mode and generated improved CV output are future scope unless explicitly approved.

## Responsibility

The AI CV Analyzer module owns:

- CV upload or CV reference input contract.
- Output language selection.
- Selected job comparison.
- Overall CV impression.
- Job fit alignment.
- ATS friendliness score.
- Keyword optimization suggestions.
- Experience quantification feedback.
- Actionable improvement steps.
- Generated CV future note.
- CV privacy and retention rules.
- Downstream Model API failure mapping.

The AI CV Analyzer module does not own:

- General profile photo uploads.
- Long-term file storage strategy outside documented retention.
- Resume builder or generated CV document editing in MVP.
- Model training or model artifact management.
- Raw CV content exposure to frontend logs or backend logs.

## Route Prefix

```text
/api/v1/ai/cv-analyzer
```

## Endpoint Summary

| Method | Path                     | Auth          | Purpose                                        |
| ------ | ------------------------ | ------------- | ---------------------------------------------- |
| `POST` | `/api/v1/ai/cv-analyzer` | Authenticated | Analyze uploaded PDF CV against a selected job |

Future endpoints for analysis history or generated CV download require separate documentation.

## Auth And Ownership Rules

- Route requires authenticated user identity.
- Selected job must exist in normalized job data.
- If the job is selected from bookmarks, the bookmark must belong to current user.
- If the CV is referenced by stored file id, the file metadata must belong to current user.
- Request body must not include trusted profile or preference data.
- Backend must not log raw CV content.

## Input Modes

MVP supports one of these modes:

| Mode        | Description                                             |
| ----------- | ------------------------------------------------------- |
| `UPLOAD`    | MVP. User uploads a PDF CV file in the request          |
| `REFERENCE` | Deferred. User references a previously uploaded CV file |

`REFERENCE` returns `422 VALIDATION_ERROR` until reusable CV storage is designed and implemented.

## Request Schema

For multipart upload, metadata fields are sent alongside file part.

```json
{
  "jobId": "11111111-1111-4111-8111-111111111111",
  "language": "id",
  "inputMode": "UPLOAD",
  "compareSource": "JOB_SEARCH",
  "persistResult": true
}
```

Validation:

| Field           | Rule                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| `jobId`         | Required internal job listing id                                                     |
| `language`      | Required enum: `id` or `en`                                                          |
| `inputMode`     | Required enum: `UPLOAD` or `REFERENCE`                                               |
| `compareSource` | Optional enum: `BOOKMARK`, `JOB_SEARCH`, `DIRECT_JOB_DETAIL`                         |
| `persistResult` | Optional boolean, default based on product policy                                    |
| `cvFile`        | Required for `UPLOAD` mode                                                           |
| `cvFileId`      | Optional request field for future `REFERENCE` support; ignored for MVP `UPLOAD` mode |

CV file validation:

| Rule              | Default                                                      |
| ----------------- | ------------------------------------------------------------ |
| Maximum file size | `CV_UPLOAD_MAX_BYTES`, default 5 MB                          |
| Allowed mime type | `application/pdf` for MVP                                    |
| Retention         | `CV_RETENTION_DAYS`, default 1 day for MVP temporary uploads |

## Backend-Prepared Model Payload

```json
{
  "requestId": "req_123",
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
    "description": "Build and maintain backend APIs.",
    "requirements": [
      {
        "type": "SKILL",
        "value": "TypeScript",
        "priority": "HIGH"
      }
    ],
    "skills": ["TypeScript", "PostgreSQL"],
    "experienceLevel": "ENTRY_LEVEL"
  }
}
```

Payload rules:

- Include only the temporary file reference or extracted text needed by Model API according to final integration design.
- Do not include passwords, tokens, OTP values, or unrelated profile data.
- Do not persist raw extracted CV text unless retention and privacy rules are documented.
- Propagate request id to Model API.
- Normalize frontend-facing language selection to the internal downstream enum expected by Model API.

## Response Schema

```json
{
  "success": true,
  "message": "CV analysis completed successfully",
  "data": {
    "jobId": "11111111-1111-4111-8111-111111111111",
    "language": "id",
    "overallImpression": {
      "score": 85,
      "summary": "CV sudah relevan untuk role backend entry-level, terutama pada pengalaman TypeScript API."
    },
    "jobFitAlignment": {
      "score": 78,
      "summary": "Skill utama sesuai, tetapi pengalaman deployment masih perlu diperkuat.",
      "matchedSignals": ["TypeScript", "REST API", "PostgreSQL"],
      "missingSignals": ["Docker", "CI/CD"]
    },
    "atsFriendliness": {
      "score": 74,
      "issues": [
        "Beberapa section belum memakai heading standar.",
        "Keyword deployment belum cukup terlihat."
      ]
    },
    "keywordOptimization": {
      "recommendedKeywords": ["Docker", "CI/CD", "API Documentation"],
      "reason": "Keyword ini muncul pada requirement dan relevan dengan backend role."
    },
    "experienceQuantification": {
      "score": 70,
      "suggestions": [
        "Tambahkan metrik jumlah endpoint yang dibuat.",
        "Tambahkan dampak performa atau reliability jika tersedia."
      ]
    },
    "actionableImprovements": [
      "Tambahkan ringkasan 2-3 kalimat yang menonjolkan backend API experience.",
      "Tambahkan keyword Docker jika memang pernah digunakan.",
      "Ubah bullet experience agar menyertakan angka atau dampak."
    ],
    "generatedCv": {
      "available": false,
      "note": "Generated CV is future scope."
    },
    "model": {
      "name": "cv-analyzer-model",
      "version": "v1"
    },
    "analyzedAt": "2026-04-22T00:00:00.000Z"
  },
  "meta": null
}
```

Response rules:

- Scores are integers from `0` to `100`.
- Output language should follow requested `language`.
- Do not return raw Model API internals.
- Do not return raw full CV text by default.
- Keep generated CV explicitly unavailable in MVP unless future scope changes.

## Service Logic

1. Require authenticated identity.
2. Validate metadata fields and upload/reference mode.
3. Validate selected `JobListing`.
4. If `compareSource` is `BOOKMARK`, verify current user owns the bookmark for the job.
5. Validate CV file or referenced CV metadata ownership.
6. Store CV file or temporary metadata according to retention policy.
7. Build backend-prepared Model API payload.
8. Call Model API with timeout and request id.
9. Validate Model API response with Zod.
10. Map result to product-safe response.
11. Optionally persist `CvAnalysisResult` snapshot and sanitized file metadata.
12. Return standard success envelope.

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

- Persist sanitized analysis snapshots only when `persistResult=true`.
- Store CV file metadata separately from raw analysis result.
- Store `expiresAt` for uploaded CV files.
- Store `deletedAt` after deletion.
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
- `uploadedAt`
- `expiresAt`
- `deletedAt`

## Downstream Failure Behavior

| Failure                    | Status     | Error code                                       | Behavior                            |
| -------------------------- | ---------- | ------------------------------------------------ | ----------------------------------- |
| Invalid file type          | 422        | `VALIDATION_ERROR`                               | Reject before storage or model call |
| File too large             | 413        | `PAYLOAD_TOO_LARGE`                              | Reject before storage or model call |
| Job not found              | 404        | `JOB_NOT_FOUND`                                  | No model call                       |
| Bookmark not owned         | 404        | `BOOKMARK_NOT_FOUND`                             | Hide ownership details              |
| Model API timeout          | 503        | `SERVICE_UNAVAILABLE`                            | Return safe AI unavailable error    |
| Model API invalid response | 502        | `DOWNSTREAM_ERROR`                               | Reject untrusted output             |
| Storage unavailable        | 500 or 503 | `INTERNAL_SERVER_ERROR` or `SERVICE_UNAVAILABLE` | Do not call model                   |

## Error Cases

| Case                                | Status     | Error code                                       |
| ----------------------------------- | ---------- | ------------------------------------------------ |
| Missing auth                        | 401        | `UNAUTHENTICATED`                                |
| Invalid request body                | 422        | `VALIDATION_ERROR`                               |
| Invalid language                    | 422        | `VALIDATION_ERROR`                               |
| Invalid CV file                     | 422        | `VALIDATION_ERROR`                               |
| CV file too large                   | 413        | `PAYLOAD_TOO_LARGE`                              |
| Job not found                       | 404        | `JOB_NOT_FOUND`                                  |
| Unsupported `REFERENCE` mode        | 422        | `VALIDATION_ERROR`                               |
| Bookmark not found for current user | 404        | `BOOKMARK_NOT_FOUND`                             |
| Storage unavailable                 | 500 or 503 | `INTERNAL_SERVER_ERROR` or `SERVICE_UNAVAILABLE` |
| Model unavailable                   | 503        | `SERVICE_UNAVAILABLE`                            |
| Model invalid response              | 502        | `DOWNSTREAM_ERROR`                               |

## Observability

Log safe structured events:

- `ai_cv_analyzer.requested`
- `ai_cv_analyzer.completed`
- `ai_cv_analyzer.failed`
- `ai_cv_analyzer.persisted`

Include:

- `requestId`
- `userId`
- `jobId`
- `language`
- `inputMode`
- `fileSizeBytes`
- `mimeType`
- `modelVersion` when available
- dependency latency
- result

Do not log original CV content, extracted full text, tokens, or storage credentials.

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
