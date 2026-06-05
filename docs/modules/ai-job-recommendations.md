---
title: AI Job Recommendations Module
description: Retired standalone AI job recommendations API surface for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/ai-job-recommendations.md
last_reviewed: 2026-05-23
---

# AI Job Recommendations Module

Standalone AI job recommendation endpoints are not exposed by the current public API.

Simple job recommendations are embedded in the CV Analyzer response under `analysisResult.jobRecommendations`. The active public AI route for recommendation output is:

```text
POST /api/v1/ai/cv-analyzer
```

## Current Contract

Each `jobRecommendations` item contains:

| Field         | Rule                                                       |
| ------------- | ---------------------------------------------------------- |
| `jobId`       | Internal job id or `null` if no catalog binding is present |
| `title`       | Job title                                                  |
| `companyName` | Company name or `null`                                     |
| `matchScore`  | Integer `0-100`                                            |
| `reason`      | Short explanation of why the job is relevant               |
| `nextStep`    | One suggested next action                                  |

Maximum item count is `5`.

## Routing Rule

Do not mount or document standalone `/api/v1/ai/job-recommendations` endpoints unless a separate API contract is approved.

## Related Docs

- `docs/modules/ai-cv-analyzer.md`
- `docs/api-reference.md`
