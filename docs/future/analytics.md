---
title: Future Analytics And Application Intelligence
description: Future Backend API scope for Application Intelligence, user success metrics, fit-score usage, product analytics, privacy boundaries, and reporting.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/future/analytics.md
last_reviewed: 2026-04-22
---

# Future Analytics And Application Intelligence

Analytics is future scope beyond the MVP Backend API. The MVP should collect only the data needed to deliver user-facing workflows: profile, preferences, jobs, bookmarks, application tracker records, and optional AI result snapshots.

This document captures the future Application Intelligence direction without turning MVP implementation into a broad analytics platform.

## Scope Status

| Capability                                      | Status                                      |
| ----------------------------------------------- | ------------------------------------------- |
| Application tracker records                     | MVP                                         |
| Optional AI fit score and CV analysis snapshots | MVP if needed for repeat viewing or history |
| Application Intelligence insights               | Future scope beyond basic tracker           |
| User success metrics                            | Future scope                                |
| Fit-score usage analytics                       | Future scope                                |
| Product funnel analytics                        | Future scope                                |
| Team or admin dashboards                        | Future scope                                |
| Employer analytics                              | Future scope, separate product decision     |

MVP implementation should keep data clean enough for future insights, but should not build analytics dashboards unless scope changes.

## Application Intelligence Direction

The product idea describes Application Intelligence as a feedback loop that helps users learn from application outcomes.

Future user-facing insights may include:

- Application count by status.
- Interview conversion rate.
- Rejection patterns by role, skill, or experience requirement.
- Bottleneck detection such as repeated missing skills.
- Suggested next actions based on tracker history.
- Relationship between fit scores and application outcomes.
- Recommended profile or CV improvements based on outcomes.

These insights must be explainable and actionable. Avoid black-box metrics that cannot guide the user.

## Potential Metrics

### User Success Metrics

| Metric                           | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| Applications created             | Measure job search activity               |
| Applications reaching interview  | Measure progress beyond submission        |
| Applications accepted            | Measure successful outcomes               |
| Time from saved to applied       | Understand action delay                   |
| Time from applied to next status | Understand tracker progression            |
| Repeated rejection category      | Identify possible bottlenecks             |
| Profile completeness             | Estimate readiness for AI recommendations |

### Fit-Score Usage Metrics

| Metric                             | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| Fit analyses requested             | Understand AI feature usage                 |
| Average fit score by role category | Detect matching patterns                    |
| Skill gaps repeated across jobs    | Identify improvement priorities             |
| Fit score before application       | Compare recommendation behavior with action |
| Fit score and outcome correlation  | Validate product value over time            |
| Model failure rate                 | Monitor AI reliability                      |

### Product Analytics Metrics

| Metric                             | Purpose                             |
| ---------------------------------- | ----------------------------------- |
| Job search frequency               | Understand discovery usage          |
| Filter usage                       | Improve job search UX and ranking   |
| Bookmark conversion to application | Measure saved-job usefulness        |
| CV Analyzer usage                  | Understand CV improvement demand    |
| Preference update frequency        | Understand personalization maturity |
| Notification engagement            | Future notification quality signal  |

## Data Sources

Future analytics should derive from existing product data before adding new tracking.

| Source                     | Owner                                   | Analytics use                                   |
| -------------------------- | --------------------------------------- | ----------------------------------------------- |
| `ApplicationRecord`        | Backend API                             | Status progression and outcomes                 |
| `ApplicationStatusHistory` | Backend API                             | Timeline and transition metrics                 |
| `Bookmark`                 | Backend API                             | Saved-to-applied conversion                     |
| `UserProfile`              | Backend API                             | Profile completeness and segment context        |
| `UserPreference`           | Backend API                             | Preference fit and recommendation context       |
| `FitScoreResult`           | Backend API stores, Model API generates | Score history and score/outcome relation        |
| `SkillGapResult`           | Backend API stores, Model API generates | Repeated missing skills                         |
| `CvAnalysisResult`         | Backend API stores, Model API generates | CV quality trend if retained                    |
| `JobListing`               | Scraper API writes, Backend API reads   | Role, source, location, and requirement context |
| Request logs               | Backend API                             | Operational usage, not primary product truth    |

Analytics should prefer normalized durable records over raw logs for user-facing insights.

## Future Domain Model Direction

Potential future entities:

| Entity                      | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `ApplicationInsight`        | User-facing derived insight snapshot              |
| `UserSuccessMetricSnapshot` | Periodic summary of user progress                 |
| `FitScoreUsageEvent`        | Sanitized event for AI feature usage              |
| `ProductEvent`              | Generic event stream if product analytics expands |
| `RecommendationFeedback`    | User response to suggested jobs or improvements   |

These tables should not be added until the analytics contract is approved.

## API Direction

Possible future endpoints:

| Method | Route                                | Auth          | Purpose                                       |
| ------ | ------------------------------------ | ------------- | --------------------------------------------- |
| `GET`  | `/api/v1/me/insights/applications`   | Authenticated | User-facing application intelligence summary  |
| `GET`  | `/api/v1/me/insights/skills`         | Authenticated | Repeated skill gap and improvement insights   |
| `GET`  | `/api/v1/me/insights/fit-score`      | Authenticated | Fit-score usage and trend summary             |
| `POST` | `/api/v1/me/recommendation-feedback` | Authenticated | Capture feedback on recommendation usefulness |
| `GET`  | `/api/v1/internal/analytics/health`  | Internal      | Analytics pipeline health if split later      |

These routes are future placeholders and must not be added to MVP route registration.

## Product Analytics Boundary

Product analytics must not blur service ownership.

Rules:

- Backend API owns product state and user-facing analytics endpoints.
- Model API owns inference generation, not product analytics storage.
- Scraper API owns job collection and normalization, not user analytics.
- Frontend UI may emit UI events later, but it must not be the only source of critical user outcome truth.
- Central docs own cross-service analytics concepts only when analytics becomes a platform concern.

If analytics becomes a separate service, update service dependency maps and documentation sync rules before implementation.

## Privacy And Safety

Analytics must be designed around data minimization.

Rules:

- Do not store raw CV content for analytics.
- Do not use raw passwords, tokens, OTP values, or auth secrets in analytics.
- Avoid storing sensitive free-text notes from application tracker as analytics dimensions.
- Use user-owned insights for authenticated users unless an aggregated reporting policy is approved.
- Aggregate or anonymize metrics before team-level or admin reporting.
- Document retention before persisting analytics events.
- Provide deletion behavior aligned with account deletion and CV retention decisions.

## Relationship To AI

Future analytics can help validate AI usefulness, but it must not silently change model behavior.

Allowed future uses:

- Compare fit-score bands with user outcomes.
- Identify repeated skill gaps to improve recommendations.
- Track Model API failure and degradation rates.
- Evaluate whether CV Analyzer suggestions lead to improved application outcomes.

Requires explicit approval:

- Feeding user outcome data back into model training.
- Using sensitive CV contents for analytics.
- Creating automated ranking changes based on private user outcomes.
- Sharing aggregate employer-facing insights.

## Testing Direction

Future tests should cover:

- Insight calculation from deterministic tracker fixtures.
- User ownership on every insight endpoint.
- Exclusion of private notes and raw CV data.
- Snapshot refresh behavior.
- Empty-state insights for users with little data.
- Fit-score and outcome correlation logic.
- Retention and deletion behavior.

## Open Decisions

- Whether Application Intelligence is computed on request, scheduled, or event-driven.
- Whether analytics snapshots are stored in PostgreSQL or another system.
- Whether product analytics is internal-only or user-facing first.
- Whether employer dashboard analytics are part of Bisakerja future scope.
- Whether data is used for model evaluation or model training.
- Which retention policy applies to analytics events and snapshots.

## Related Docs

- `docs/modules/applications.md`
- `docs/modules/ai-job-fit.md`
- `docs/modules/ai-cv-analyzer.md`
- `docs/integrations/model-api.md`
- `docs/future/notifications.md`
- `docs/future/mentoring.md`
- `docs/operations/security.md`
- `docs/operations/observability.md`
- `bisakerja-product-idea.md`
- `bisakerja-project-plan.md`
