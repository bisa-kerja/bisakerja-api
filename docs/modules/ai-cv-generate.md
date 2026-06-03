---
title: AI CV Generate Module
description: Authenticated markdown HTML CV generation from a stored CV reference, structured summary, and safe template input.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-cv-generate.md
last_reviewed: 2026-05-23
---

# AI CV Generate Module

AI CV Generate creates improved markdown HTML CV content from a current user's stored CV file reference, a structured CV summary, and a required HTML template. Backend API owns CV ownership checks, CV storage reads, evidence building, prompt orchestration, GenAI provider calls, output safety, and the public response envelope. Frontend must call Backend API only; Model API remains model-core only and does not expose `/cv-generate`.

## Route Prefix

```text
/api/v1/ai/cv-generate
```

## Endpoint

| Method | Path                     | Auth          | Purpose                                                                            |
| ------ | ------------------------ | ------------- | ---------------------------------------------------------------------------------- |
| `POST` | `/api/v1/ai/cv-generate` | Authenticated | Generate final markdown HTML CV content from a CV reference, summary, and template |

## Request

```json
{
  "cvFileId": "11111111-1111-4111-8111-111111111111",
  "summary": "Backend candidate with REST API, PostgreSQL, and basic deployment experience.",
  "templateHtml": "<section><h1>{{name}}</h1><p>{{summary}}</p></section>"
}
```

Validation rules:

| Field          | Rule                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `cvFileId`     | Required UUID. Must belong to current user.                                |
| `summary`      | Required non-empty string, max 8,000 characters.                           |
| `templateHtml` | Required non-empty string, max 20,000 characters. HTML is untrusted input. |

## Response

`201 Created`

```json
{
  "success": true,
  "message": "Markdown CV created successfully",
  "data": {
    "markdown": "<section><h1>Candidate Name</h1><h2>Summary</h2><p>Backend candidate with REST API, PostgreSQL, and basic deployment experience.</p></section>"
  },
  "meta": null
}
```

Response data only contains `markdown`.

## Ownership And Privacy

- Backend validates `cvFileId` ownership before reading CV storage.
- CV files owned by another user return `404 CV_FILE_NOT_FOUND`.
- Backend sends only sanitized evidence, summary, and sanitized template input to the GenAI provider.
- Raw prompt, raw CV text, service credentials, storage key, provider payloads, and Model API internals are never exposed to frontend.
- Generated markdown is returned to the caller but is not saved as a user CV document by this endpoint.

## Output Safety

Generated markdown must be non-empty, within 50,000 characters, and must not contain executable HTML patterns such as `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers, or `javascript:` URLs. Invalid output is rejected with `502 MODEL_OUTPUT_INVALID`. Frontend should still sanitize before rendering.

## Errors

| Status | Code                   | Meaning                                                                  |
| -----: | ---------------------- | ------------------------------------------------------------------------ |
|    401 | `UNAUTHENTICATED`      | Missing or invalid access token.                                         |
|    404 | `CV_FILE_NOT_FOUND`    | CV file does not exist, expired, deleted, or belongs to another user.    |
|    422 | `VALIDATION_ERROR`     | Request body fails validation.                                           |
|    413 | `PAYLOAD_TOO_LARGE`    | Request exceeds configured body size limit.                              |
|    502 | `MODEL_OUTPUT_INVALID` | Generated markdown is empty, too long, or unsafe.                        |
|    503 | `SERVICE_UNAVAILABLE`  | CV storage or GenAI provider is unavailable, unconfigured, or timed out. |

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/integrations/model-api.md`
- `docs/api-reference.md`
