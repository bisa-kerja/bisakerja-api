---
title: Future Mentoring Module
description: Future Backend API scope for mentor onboarding, mentor profiles, availability, search, booking, and mentoring dashboards.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/future/mentoring.md
last_reviewed: 2026-04-22
---

# Future Mentoring Module

Mentoring is future scope for Bisakerja. It should not be implemented as part of the MVP Backend API unless the product scope is explicitly revised.

This document preserves the product direction from `bisakerja-feature-flow.md` while keeping MVP implementation focused on auth, profiles, preferences, jobs, bookmarks, applications, AI Job Fit, and AI CV Analyzer.

## Scope Status

| Area                            | Status                                                 |
| ------------------------------- | ------------------------------------------------------ |
| Mentor search and filter        | Future scope                                           |
| Mentor profile and detail       | Future scope                                           |
| Mentor onboarding               | Future scope                                           |
| Mentor availability management  | Future scope                                           |
| Booking and schedule management | Future scope                                           |
| Mentor dashboard                | Future scope                                           |
| Mentoring notifications         | Future scope, linked to `docs/future/notifications.md` |
| Payment or paid sessions        | Out of scope until a monetization decision exists      |

MVP code should not create mentoring tables, routes, or background jobs unless a later approved iteration changes the roadmap.

## Product Concepts

The feature flow describes these mentoring capabilities:

- Search mentor.
- Filter by expertise, job type, and division/category.
- Sort mentor list A to Z.
- Show mentor cards with profile photo, current role, company, education, skill badges, experience, and slot availability.
- Show mentor detail with bio, expertise topics, availability schedule, and statistics.
- Provide a mentor dashboard for profile and schedule management.

These concepts should be treated as discovery inputs, not implementation-ready contracts.

## Future Users And Roles

| Actor                    | Description                                           | Future capability                                         |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------- |
| Mentee                   | Bisakerja user seeking career guidance                | Search mentors, view detail, request or book sessions     |
| Mentor                   | Experienced user or partner providing guidance        | Manage mentor profile, availability, and session requests |
| Admin or operations user | Internal reviewer if mentor quality control is needed | Approve mentors, handle reports, manage categories        |

The MVP auth model currently documents end-user authentication only. Mentor roles and admin permissions require a separate authorization design before implementation.

## Future Domain Model Direction

Potential future entities:

| Entity                   | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `MentorProfile`          | Public mentor identity, headline, bio, company, role, education, experience summary |
| `MentorSkill`            | Mentor-to-skill or mentor-to-topic relation                                         |
| `MentorCategory`         | Division or expertise grouping used for filters                                     |
| `MentorAvailabilitySlot` | Mentor-defined available session windows                                            |
| `MentoringBooking`       | Mentee session request or confirmed booking                                         |
| `MentoringSession`       | Completed or scheduled session record                                               |
| `MentorReview`           | Optional future feedback or quality signal                                          |

Initial ownership should stay in Backend API because mentor profiles, availability, bookings, and dashboard data are product state. If payments or external calendars are added later, those integrations need separate docs.

## Future API Direction

Possible route groups:

| Method   | Route                                    | Auth                           | Purpose                        |
| -------- | ---------------------------------------- | ------------------------------ | ------------------------------ |
| `GET`    | `/api/v1/mentors`                        | Public or authenticated        | Search mentor list             |
| `GET`    | `/api/v1/mentors/:mentorId`              | Public or authenticated        | View mentor detail             |
| `POST`   | `/api/v1/me/mentor-profile`              | Authenticated mentor           | Create mentor profile          |
| `PUT`    | `/api/v1/me/mentor-profile`              | Authenticated mentor           | Update mentor profile          |
| `GET`    | `/api/v1/me/mentor-dashboard`            | Authenticated mentor           | View mentor dashboard          |
| `POST`   | `/api/v1/me/mentor-availability`         | Authenticated mentor           | Create availability slot       |
| `DELETE` | `/api/v1/me/mentor-availability/:slotId` | Authenticated mentor and owner | Remove availability slot       |
| `POST`   | `/api/v1/mentors/:mentorId/bookings`     | Authenticated mentee           | Request a mentoring booking    |
| `GET`    | `/api/v1/me/mentoring-bookings`          | Authenticated user             | List user's mentoring bookings |

These routes are placeholders only. Do not add them to MVP route registration without revisiting API contracts, database schema, auth roles, and tests.

## Search And Filter Direction

Future mentor search should support:

- Keyword search by mentor name, role, company, or expertise.
- Expertise or skill filter.
- Job type or career category filter.
- Division/category filter.
- Availability filter.
- Sort by A to Z initially, then relevance or availability if product logic is defined.

Response shape should follow `docs/api-response-standard.md` list metadata rules.

## Availability And Booking Rules

Before booking implementation, document:

- Slot timezone handling.
- Slot duration and capacity.
- Booking statuses.
- Cancellation and reschedule policy.
- Double-booking prevention.
- Mentor ownership checks.
- Mentee ownership checks.
- Notification triggers.
- Whether payment is required before confirmation.

Suggested booking statuses:

| Status        | Meaning                                        |
| ------------- | ---------------------------------------------- |
| `REQUESTED`   | Mentee requested a session                     |
| `CONFIRMED`   | Mentor or system confirmed the booking         |
| `RESCHEDULED` | Time changed after request                     |
| `CANCELLED`   | Booking cancelled by mentor, mentee, or system |
| `COMPLETED`   | Session completed                              |

## Mentor Dashboard Direction

Future dashboard data may include:

- Mentor profile completeness.
- Latest role and company.
- Availability slots.
- Upcoming booking requests.
- Confirmed sessions.
- Completed sessions.
- Basic mentoring activity statistics.

Dashboard responses should not expose mentee private profile details beyond what is needed to run the session.

## Authorization And Privacy

Future implementation must define:

- How a user becomes a mentor.
- Whether mentor approval is required.
- Which mentor fields are public.
- Which booking fields are visible to mentee, mentor, and admin.
- How reports, abuse handling, and account suspension interact with mentoring.
- Whether WhatsApp, email, calendar, or external meeting links are stored.

Mentor and mentee ownership checks must be enforced in the Backend API.

## Integration Dependencies

Potential dependencies:

| Dependency             | Use                                              |
| ---------------------- | ------------------------------------------------ |
| Email provider         | Booking confirmations and reminders              |
| Notification system    | In-app or email mentoring activity notifications |
| Calendar provider      | Optional future calendar sync                    |
| Video meeting provider | Optional future meeting link creation            |
| Payment provider       | Optional future paid mentoring sessions          |

None of these dependencies are required for MVP Backend API implementation.

## Testing Direction

Future tests should cover:

- Mentor profile validation.
- Public mentor list filters and pagination.
- Mentor detail response shape.
- Availability create/delete ownership.
- Double-booking prevention.
- Booking status transitions.
- Mentor dashboard ownership.
- Notification event emission without direct delivery coupling.

## Open Decisions

- Whether mentoring is free, paid, or mixed.
- Whether mentor approval is manual or automatic.
- Whether mentor and mentee are both ordinary users or separate account types.
- Whether availability slots are one-on-one only.
- Whether external calendar or meeting link integrations are needed.
- Whether reviews or mentor statistics are part of first mentoring release.

## Related Docs

- `docs/future/notifications.md`
- `docs/future/analytics.md`
- `docs/modules/users.md`
- `docs/modules/preferences.md`
- `docs/operations/security.md`
- `bisakerja-feature-flow.md`
