---
title: AI Job Fit Module
description: Retired standalone AI job fit API surface for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-job-fit.md
last_reviewed: 2026-05-23
---

# AI Job Fit Module

Standalone AI job fit endpoints are not exposed by the current public API.

Job fit scoring is part of the CV Analyzer response under `analysisResult.jobFitAlignment`. The active public AI route for fit-style output is:

```text
POST /api/v1/ai/cv-analyzer
```

## Current Contract

The CV Analyzer response includes:

- `jobFitAlignment.score`: integer `0-100`.
- `jobFitAlignment.summary`: concise explanation of alignment.
- `jobFitAlignment.matchedSignals`: safe matched skills or role signals.
- `jobFitAlignment.missingSignals`: safe missing skills or role signals.

## Routing Rule

Do not mount or document a standalone `/api/v1/ai/job-fit` endpoint unless a separate API contract is approved.

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/api-reference.md`
