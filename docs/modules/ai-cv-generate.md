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
last_reviewed: 2026-06-05
---

# AI CV Generate Module

AI CV Generate creates improved markdown HTML CV content from a current user's stored CV file reference, a structured CV summary, and a required HTML template. Backend API owns CV ownership checks, CV storage reads, structured current-CV evidence building, prompt orchestration, GenAI provider calls, template structural validation, deterministic fallback rendering, output safety, and the public response envelope. `AI_CV_GENERATE_GENAI_ENABLED` controls Generate provider calls independently from Analyzer wrapper provider calls. Frontend must call Backend API only; Model API remains model-core only and does not expose `/cv-generate`.

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
- Backend sends only sanitized structured current-CV evidence, latest analyzer context when it belongs to the same CV file, summary, template policy, and sanitized template input to the GenAI provider when `AI_CV_GENERATE_GENAI_ENABLED=true`.
- Backend does not send raw CV text previews, raw prompt text, service credentials, storage key, provider payloads, or Model API internals to frontend.
- Contact data is redacted from generation evidence in MVP; unsupported names, companies, roles, dates, skills, metrics, education, certifications, and hiring outcomes must not be invented.
- Generated markdown is returned to the caller but is not saved as a user CV document by this endpoint.

## Evidence And Template Policy

Backend builds the shared CV evidence schema `shared-cv-evidence-v1` before generation. Evidence can include a candidate summary, section evidence, section summaries, experience bullets, project bullets, skills grouped by category, skill/requirement coverage, education, certifications, languages, ATS/actionable gaps, parser confidence, source hash, cache policy, invalidation policy, confidence flags, and a contact redaction policy. MVP parsing for Generate is Backend-owned. If stored CV bytes do not expose reliable plain text, Backend uses the latest analyzer result for the same CV file when available; otherwise generation must rely only on the request summary and metadata-level confidence flags.

Shared evidence cache entries are invalidated when the CV source hash changes, parser version changes, analyzer model version changes, template policy version changes, or retention expires. Raw CV text, contact data, prompts, provider payloads, and storage identifiers must not be cached, logged, or sent to the provider.

`templateHtml` is required. Generated output must preserve the sanitized template's original tag sequence, section order, class, style, id, data attributes, other attributes, and static copy. Only `{{placeholder}}` regions or obvious placeholder text may be rewritten. Missing evidence must result in empty or minimal grounded content, not fabricated facts. If provider output changes structure, Backend renders a deterministic fallback from structured evidence; if output is unsafe or the fallback cannot preserve the template, Backend rejects the response.

## Output Safety

Generated markdown must be non-empty, within 50,000 characters, and must not contain executable HTML patterns such as `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers, `javascript:` URLs, prompt text, storage identifiers, service tokens, DB URLs, raw email, or raw phone numbers. Invalid output is rejected with `502 MODEL_OUTPUT_INVALID`. Frontend should still sanitize before rendering.

## Errors

| Status | Code                   | Meaning                                                                                                                                           |
| -----: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
|    401 | `UNAUTHENTICATED`      | Missing or invalid access token.                                                                                                                  |
|    404 | `CV_FILE_NOT_FOUND`    | CV file does not exist, expired, deleted, or belongs to another user.                                                                             |
|    422 | `VALIDATION_ERROR`     | Request body fails validation.                                                                                                                    |
|    413 | `PAYLOAD_TOO_LARGE`    | Request exceeds configured body size limit.                                                                                                       |
|    502 | `MODEL_OUTPUT_INVALID` | Generated markdown is empty, too long, or unsafe.                                                                                                 |
|    503 | `SERVICE_UNAVAILABLE`  | CV storage is unavailable, or the GenAI provider is unconfigured. Provider runtime failures may return deterministic fallback markdown when safe. |

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/modules/shared-cv-evidence.md`
- `docs/integrations/model-api.md`
- `docs/api-reference.md`
