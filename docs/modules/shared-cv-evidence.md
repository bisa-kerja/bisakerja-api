---
title: Shared CV Evidence Layer
description: Sanitized Backend-owned CV evidence schema shared by AI CV Analyzer wrapper and AI CV Generate.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/shared-cv-evidence.md
last_reviewed: 2026-06-04
---

# Shared CV Evidence Layer

Shared CV evidence is the Backend-owned sanitized context layer used by AI CV Analyzer wrapper copy and AI CV Generate. It keeps both flows on one bounded schema and prevents each flow from inventing its own weak parser context.

## MVP Parser Ownership

MVP ownership lives in Backend API.

- Backend owns sanitized evidence schema, cache key construction, retention policy, invalidation policy, privacy rules, observability fields, and GenAI allowlists.
- Model API remains the primary parser source when Analyzer calls model-core inference. Backend converts Model API parser/scoring signals into shared evidence for wrapper copy.
- AI CV Generate uses Backend parser evidence from the owned stored CV file. If reliable text is unavailable, it may use latest analysis evidence for the same CV file, then metadata-only context.
- Raw CV text caching is forbidden. Only bounded sanitized structured fields may be cached or sent to GenAI providers.

Fallback order:

1. `model_api` for Analyzer wrapper after model-core inference.
2. `backend_parser` for Generate from the current owned CV file.
3. `latest_analysis_cache` when stored bytes cannot produce reliable text and latest analysis belongs to the same CV file.
4. `metadata_only` when no structured evidence is available.

## Schema

Schema version: `shared-cv-evidence-v1`.

Top-level fields:

| Field              | Purpose                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `source`           | Evidence source: `model_api`, `backend_parser`, `latest_analysis_cache`, or `metadata_only`.                     |
| `parserOwner`      | Parser ownership decision for current evidence.                                                                  |
| `parserVersion`    | Parser/schema producer version used for invalidation.                                                            |
| `parserConfidence` | `high`, `medium`, or `low`.                                                                                      |
| `sourceHash`       | SHA-256 source fingerprint for invalidation.                                                                     |
| `cvFile`           | Safe file metadata: file id, MIME type, and file-size count for Backend-internal cache policy.                   |
| `cache`            | Cache key, status, created/expiry timestamps, invalidation, and retention rules.                                 |
| `candidateSummary` | Bounded sanitized summary when available.                                                                        |
| `sectionEvidence`  | Bounded section summaries and items with confidence.                                                             |
| `skillEvidence`    | Skills grouped by category and requirement coverage.                                                             |
| `atsEvidence`      | ATS score/summary/actionables when available.                                                                    |
| `confidenceFlags`  | Flow-safe caveats for weak parser or fallback evidence.                                                          |
| `privacy`          | Boolean no-retention guarantees for raw text, contact data, prompts, provider payloads, and storage identifiers. |

## Cache Invalidation

Shared evidence is invalid when any of these changes:

- CV file hash or safe source metadata changes.
- Parser version changes.
- Analyzer model version changes.
- Generate template policy version changes.
- Retention expiry passes.

The cache key includes schema version, source hash, parser version, analyzer model version, and template policy version. This enables safe reuse without retaining raw CV text.

## Privacy And Logging

Allowed retained fields are bounded structured evidence, safe file metadata, parser/source metadata, cache policy, and observability counts.

Forbidden retained fields:

- raw CV text or PDF content
- email, phone, address, or raw contact data
- prompts or provider payloads
- storage identifiers
- auth headers, tokens, secrets, database URLs

Logs may include only safe observability fields: schema version, source, parser owner/version/confidence, cache status, section count, skill count, requirement coverage count, actionable count, and no-leak booleans.

## Flow Usage

Analyzer wrapper:

1. Backend resolves owned CV and candidate jobs.
2. Backend calls Model API.
3. Backend builds `model_api` shared evidence from parser, ATS, skill, and requirement signals.
4. Backend sends allowlisted wrapper input plus shared evidence to optional GenAI provider.
5. Provider output must preserve model-owned scores, metadata, candidate ids, order, and timestamps.

Generate:

1. Backend validates `cvFileId` ownership.
2. Backend reads stored CV bytes.
3. Backend builds `backend_parser` shared evidence.
4. If parser evidence is weak, Backend uses latest analysis for same CV file or metadata-only evidence.
5. Backend sends shared evidence plus template policy to optional GenAI provider.
6. Backend validates template structure and safety before returning markdown.

## Observability

Track:

- parser confidence
- evidence source
- cache hit/miss/bypass
- wrapper fallback reason
- template validation failure reasons
- no-leak checks

Observability must not include raw CV text, contact data, storage identifiers, provider payloads, prompts, tokens, or secrets.

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/modules/ai-cv-generate.md`
- `docs/integrations/model-api.md`
