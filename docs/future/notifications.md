---
title: Future Notifications Module
description: Future notification scope for email preferences, job recommendations, tracker updates, mentoring activity, event triggers, and delivery boundaries.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/future/notifications.md
last_reviewed: 2026-04-22
---

# Future Notifications Module

Notifications are future scope beyond the MVP Backend API, except for storing the user's email notification preference as part of career preferences.

This document captures the future direction without requiring MVP implementation of notification delivery, queues, templates, or background workers.

## Scope Status

| Capability                                | Status               |
| ----------------------------------------- | -------------------- |
| Store email notification preference       | MVP preference field |
| Send email verification or password reset | MVP auth email flow  |
| Job recommendation notifications          | Future scope         |
| Application tracker notifications         | Future scope         |
| Mentoring activity notifications          | Future scope         |
| In-app notification inbox                 | Future scope         |
| Push notifications                        | Future scope         |
| Notification analytics                    | Future scope         |

Do not build general notification infrastructure during MVP unless an implemented auth email flow requires a minimal email provider abstraction.

## Notification Types

Future notification families:

| Type                   | Example trigger                                                    | Possible channel |
| ---------------------- | ------------------------------------------------------------------ | ---------------- |
| Job recommendation     | New or refreshed job matches user preferences                      | Email, in-app    |
| Tracker reminder       | User has not updated an application status for a configured period | Email, in-app    |
| Tracker outcome prompt | Application marked rejected or interview completed                 | In-app, email    |
| Mentoring booking      | Booking requested, confirmed, cancelled, or rescheduled            | Email, in-app    |
| Mentoring reminder     | Upcoming mentoring session                                         | Email, in-app    |
| Account security       | Password reset, email verification, suspicious login               | Email            |
| Product tips           | Suggested profile, CV, or preference improvement                   | In-app, email    |

Account security emails belong to Auth operations and should not wait for the full future notification module.

## Preference Model Direction

Current MVP preference docs reserve an email notification toggle. Future notifications need more granular preferences.

Possible future preference fields:

| Field                            | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `emailNotificationsEnabled`      | Master email toggle                           |
| `jobRecommendationEmailsEnabled` | Job recommendation delivery                   |
| `trackerReminderEmailsEnabled`   | Application tracker reminders                 |
| `mentoringEmailsEnabled`         | Mentoring booking and reminder emails         |
| `productTipsEnabled`             | Profile, CV, and strategy tips                |
| `quietHoursStart`                | Optional time window for delivery suppression |
| `quietHoursEnd`                  | Optional time window for delivery suppression |
| `timezone`                       | User-local scheduling and reminder logic      |

Preference changes must be user-owned and must not affect account security emails that are legally or operationally required.

## Event Trigger Assumptions

Future notification delivery should be event-driven.

Potential event sources:

| Event                                 | Producer                                | Consumer                    |
| ------------------------------------- | --------------------------------------- | --------------------------- |
| `jobs.recommendation_candidate_found` | Job recommendation or matching workflow | Notification service/module |
| `applications.created`                | Applications module                     | Notification service/module |
| `applications.status_changed`         | Applications module                     | Notification service/module |
| `applications.stale_status_detected`  | Future scheduled job                    | Notification service/module |
| `mentoring.booking_requested`         | Future mentoring module                 | Notification service/module |
| `mentoring.booking_confirmed`         | Future mentoring module                 | Notification service/module |
| `mentoring.session_upcoming`          | Future scheduled job                    | Notification service/module |
| `auth.email_verification_requested`   | Auth module                             | Email provider abstraction  |
| `auth.password_reset_requested`       | Auth module                             | Email provider abstraction  |

MVP implementation can log or emit internal events for observability, but durable asynchronous notification delivery should wait for a dedicated design.

## Future Data Model Direction

Potential entities:

| Entity                   | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `NotificationPreference` | User-level channel and category preferences |
| `NotificationEvent`      | Durable event record for delivery pipeline  |
| `NotificationDelivery`   | Attempt tracking per channel and recipient  |
| `NotificationTemplate`   | Template metadata and versioning            |
| `InAppNotification`      | User-visible notification inbox item        |

Do not create these tables during MVP unless notification delivery becomes part of approved scope.

## API Direction

Possible future endpoints:

| Method  | Route                                           | Auth                        | Purpose                                           |
| ------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------- |
| `GET`   | `/api/v1/me/notifications`                      | Authenticated               | List in-app notifications                         |
| `PATCH` | `/api/v1/me/notifications/:notificationId/read` | Authenticated and owner     | Mark notification as read                         |
| `PUT`   | `/api/v1/me/notification-preferences`           | Authenticated               | Update notification preferences                   |
| `POST`  | `/api/v1/internal/notification-events`          | Internal service credential | Ingest notification event if split into a service |

These routes are future placeholders and must not be added to MVP route registration.

## Delivery Rules

Future delivery design must define:

- Template ownership.
- Delivery retry policy.
- Deduplication window.
- Unsubscribe behavior.
- Bounce and provider failure handling.
- Rate limits per user and per category.
- Quiet hours and timezone behavior.
- Security-sensitive email exceptions.
- Audit and observability requirements.

Password reset and verification email delivery should have stricter abuse controls than product recommendation emails.

## Privacy And Safety

Notification content must avoid leaking sensitive user data.

Rules:

- Do not include raw CV contents or extracted CV text in notifications.
- Do not include access tokens, reset tokens, or OTP values in logs.
- Use short-lived links or codes for auth flows.
- Avoid exposing application rejection details in email subject lines.
- Respect the user's notification preferences for non-security notifications.
- Keep service-to-service credentials out of browser-controlled notification requests.

## Observability Direction

Future notification observability should track:

- Events generated.
- Events suppressed by preference.
- Delivery attempts.
- Delivery success and failure by provider.
- Retry counts.
- Bounce or rejection counts.
- Template version used.
- User-facing notification read state if in-app notifications exist.

These metrics should avoid logging sensitive message bodies.

## Testing Direction

Future tests should cover:

- Preference update ownership.
- Preference suppression logic.
- Event-to-template mapping.
- Retry and deduplication behavior.
- Provider failure mapping.
- Auth email abuse limits.
- In-app notification read ownership.
- No sensitive content in logs.

## Open Decisions

- Whether notification delivery lives inside Backend API or a separate worker/service.
- Whether queue infrastructure is required.
- Which email provider will be used beyond auth email flows.
- Whether in-app notifications are required before mentoring.
- Whether push notifications are part of web or mobile future scope.
- Whether recommendation notifications are generated by backend rules, Model API, or a separate ranking job.

## Related Docs

- `docs/environment.md`
- `docs/modules/auth.md`
- `docs/modules/preferences.md`
- `docs/modules/applications.md`
- `docs/future/mentoring.md`
- `docs/future/analytics.md`
- `docs/operations/observability.md`
- `docs/operations/security.md`
- `bisakerja-feature-flow.md`
