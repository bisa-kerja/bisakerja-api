---
title: Backend API Route Inventory
description: Generated inventory of mounted Backend API routes and their owning modules.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/generated/routes.md
last_reviewed: 2026-05-18
generated_by: route-inventory-script
generated_at: 2026-05-18T08:53:24.071Z
source_commit: eb9710893b332b13458393943ec3ab3a8f9d40dc
---

# Backend API Route Inventory

This page is generated from the route registry used by the application runtime. It exists to make route drift visible during documentation review and sync preparation.

## Summary

| Metric        | Value                                      |
| ------------- | ------------------------------------------ |
| Total routes  | 38                                         |
| Generated at  | `2026-05-18T08:53:24.071Z`                 |
| Source commit | `eb9710893b332b13458393943ec3ab3a8f9d40dc` |

## Registered Routes

| Method   | Path                                                  | Module                   |
| -------- | ----------------------------------------------------- | ------------------------ |
| `POST`   | `/api/v1/ai/cv-analyzer`                              | `ai-cv-analyzer`         |
| `POST`   | `/api/v1/ai/job-fit`                                  | `ai-job-fit`             |
| `POST`   | `/api/v1/ai/job-recommendations`                      | `ai-job-recommendations` |
| `GET`    | `/api/v1/ai/job-recommendations/:recommendationRunId` | `ai-job-recommendations` |
| `GET`    | `/api/v1/ai/job-recommendations/latest`               | `ai-job-recommendations` |
| `POST`   | `/api/v1/auth/forgot-password`                        | `auth`                   |
| `GET`    | `/api/v1/auth/google`                                 | `auth`                   |
| `POST`   | `/api/v1/auth/google`                                 | `auth`                   |
| `POST`   | `/api/v1/auth/login`                                  | `auth`                   |
| `POST`   | `/api/v1/auth/logout`                                 | `auth`                   |
| `POST`   | `/api/v1/auth/refresh`                                | `auth`                   |
| `POST`   | `/api/v1/auth/register`                               | `auth`                   |
| `POST`   | `/api/v1/auth/reset-password`                         | `auth`                   |
| `POST`   | `/api/v1/auth/verify-email`                           | `auth`                   |
| `POST`   | `/api/v1/internal/notification-events`                | `internal`               |
| `POST`   | `/api/v1/internal/scraper/jobs`                       | `internal`               |
| `GET`    | `/api/v1/jobs`                                        | `jobs`                   |
| `GET`    | `/api/v1/jobs/:jobId`                                 | `jobs`                   |
| `GET`    | `/api/v1/me`                                          | `users`                  |
| `PATCH`  | `/api/v1/me`                                          | `users`                  |
| `GET`    | `/api/v1/me/applications`                             | `applications`           |
| `POST`   | `/api/v1/me/applications`                             | `applications`           |
| `PATCH`  | `/api/v1/me/applications/:applicationId`              | `applications`           |
| `PATCH`  | `/api/v1/me/applications/:applicationId/status`       | `applications`           |
| `GET`    | `/api/v1/me/bookmarks`                                | `bookmarks`              |
| `POST`   | `/api/v1/me/bookmarks`                                | `bookmarks`              |
| `DELETE` | `/api/v1/me/bookmarks/:jobId`                         | `bookmarks`              |
| `POST`   | `/api/v1/me/cv-files`                                 | `cv-files`               |
| `GET`    | `/api/v1/me/cv-files/active`                          | `cv-files`               |
| `PUT`    | `/api/v1/me/education`                                | `users`                  |
| `PUT`    | `/api/v1/me/experience`                               | `users`                  |
| `GET`    | `/api/v1/me/preferences`                              | `preferences`            |
| `PATCH`  | `/api/v1/me/preferences`                              | `preferences`            |
| `PUT`    | `/api/v1/me/preferences`                              | `preferences`            |
| `PUT`    | `/api/v1/me/profile-photo`                            | `users`                  |
| `PUT`    | `/api/v1/me/skills`                                   | `users`                  |
| `GET`    | `/health/live`                                        | `health`                 |
| `GET`    | `/health/ready`                                       | `health`                 |
