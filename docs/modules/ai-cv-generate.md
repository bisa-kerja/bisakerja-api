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

AI CV Generate creates improved markdown HTML CV content from a current user's stored CV file reference, a structured CV summary, and an HTML template. It does not analyze a CV from scratch and does not persist generated markdown automatically.

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
  "summary": "Kandidat backend dengan pengalaman REST API, PostgreSQL, dan deployment dasar.",
  "templateHtml": "<section><h1>{{name}}</h1><p>{{summary}}</p></section>"
}
```

Validation rules:

| Field          | Rule                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `cvFileId`     | Required UUID. Must belong to current user.                                |
| `summary`      | Required non-empty string, max 8,000 characters.                           |
| `templateHtml` | Optional non-empty string, max 20,000 characters. HTML is untrusted input. |

`templateHtml` is required.

## Response

`201 Created`

```json
{
  "success": true,
  "message": "Markdown CV berhasil dibuat",
  "data": {
    "markdown": "<section><h1>Nama Kandidat</h1><h2>Ringkasan</h2><p>Kandidat backend dengan pengalaman REST API, PostgreSQL, dan deployment dasar.</p></section>"
  },
  "meta": null
}
```

Response data only contains `markdown`.

## Ownership And Privacy

- Backend validates `cvFileId` before calling Model API.
- CV files owned by another user return `404 CV_FILE_NOT_FOUND`.
- Raw prompt, service credentials, storage key, and Model API metadata are never exposed to frontend.
- Generated markdown is returned to the caller but is not saved as a user CV document by this endpoint.

## Output Safety

Generated markdown must be non-empty and must not contain executable HTML patterns such as `<script>`, `<iframe>`, inline event handlers, or `javascript:` URLs. Invalid output is rejected with `502 MODEL_OUTPUT_INVALID`.

## Errors

| Status | Code                   | Meaning                                                               |
| -----: | ---------------------- | --------------------------------------------------------------------- |
|    401 | `UNAUTHENTICATED`      | Missing or invalid access token.                                      |
|    404 | `CV_FILE_NOT_FOUND`    | CV file does not exist, expired, deleted, or belongs to another user. |
|    422 | `VALIDATION_ERROR`     | Request body fails validation.                                        |
|    413 | `PAYLOAD_TOO_LARGE`    | Request exceeds configured body size limit.                           |
|    502 | `MODEL_OUTPUT_INVALID` | Model API returned empty or unsafe markdown.                          |
|    503 | `SERVICE_UNAVAILABLE`  | Model API is unavailable or timed out.                                |

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/integrations/model-api.md`
- `docs/api-reference.md`
