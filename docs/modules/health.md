---
title: Health Module
description: Liveness and readiness contracts for infrastructure checks in the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/health.md
last_reviewed: 2026-04-29
---

# Health Module

The Health module exposes infrastructure-safe endpoints for process liveness and runtime readiness. These routes are public so deployment systems, uptime checks, and local operators can verify the backend without authentication.

## Responsibility

The Health module owns:

- Process liveness checks.
- PostgreSQL-backed readiness checks.
- Stable infrastructure response envelopes for deploy and smoke workflows.

The Health module does not own:

- Business workflow health summaries.
- Internal dependency-detail dashboards.
- Authenticated diagnostics or admin-only runtime inspection.

## Route Prefix

```text
/health
```

## Endpoint Summary

| Method | Path            | Auth   | Purpose                                   |
| ------ | --------------- | ------ | ----------------------------------------- |
| `GET`  | `/health/live`  | Public | Confirm process is running                |
| `GET`  | `/health/ready` | Public | Confirm runtime is ready to serve traffic |

## Response Schemas

### Liveness

```json
{
  "success": true,
  "message": "Service is live",
  "data": {
    "service": "bisakerja-api",
    "status": "live",
    "env": "local"
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

### Readiness

```json
{
  "success": true,
  "message": "Service is ready",
  "data": {
    "service": "bisakerja-api",
    "status": "ready",
    "env": "local",
    "dependencies": {
      "postgresql": "healthy"
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

If PostgreSQL is unavailable or readiness times out, the backend returns `503 SERVICE_UNAVAILABLE` with the standard error envelope.

## Current Dependency Model

- `GET /health/live` does not touch PostgreSQL or external integrations.
- `GET /health/ready` currently checks PostgreSQL only.
- Model API, email, and job-freshness degradation are observed through route-level behavior and logs, not a separate health endpoint.

## Verification

- Smoke tests should cover both endpoints.
- Deploy checks should treat `/health/ready` as the traffic gate.
- Documentation and generated OpenAPI should be regenerated when health routes or payloads change.

## Related Docs

- `docs/api-reference.md`
- `docs/operations/observability.md`
- `docs/operations/deployment.md`
- `docs/operations/testing.md`
