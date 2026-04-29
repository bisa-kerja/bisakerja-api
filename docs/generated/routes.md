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
last_reviewed: 2026-04-29
generated_by: route-inventory-script
generated_at: 2026-04-29T14:51:03.185Z
source_commit: 25f3c2be8ab92b7cc1e239bdd305ebc6b31992bc
---

# Backend API Route Inventory

This page is generated from the route registry used by the application runtime. It exists to make route drift visible during documentation review and sync preparation.

## Summary

| Metric        | Value                                      |
| ------------- | ------------------------------------------ |
| Total routes  | 30                                         |
| Generated at  | `2026-04-29T14:51:03.185Z`                 |
| Source commit | `25f3c2be8ab92b7cc1e239bdd305ebc6b31992bc` |

## Registered Routes

| Method   | Path                                            | Module           |
| -------- | ----------------------------------------------- | ---------------- |
| `POST`   | `/api/v1/ai/cv-analyzer`                        | `ai-cv-analyzer` |
| `POST`   | `/api/v1/ai/job-fit`                            | `ai-job-fit`     |
| `POST`   | `/api/v1/auth/forgot-password`                  | `auth`           |
| `POST`   | `/api/v1/auth/google`                           | `auth`           |
| `POST`   | `/api/v1/auth/login`                            | `auth`           |
| `POST`   | `/api/v1/auth/logout`                           | `auth`           |
| `POST`   | `/api/v1/auth/refresh`                          | `auth`           |
| `POST`   | `/api/v1/auth/register`                         | `auth`           |
| `POST`   | `/api/v1/auth/reset-password`                   | `auth`           |
| `POST`   | `/api/v1/auth/verify-email`                     | `auth`           |
| `GET`    | `/api/v1/jobs`                                  | `jobs`           |
| `GET`    | `/api/v1/jobs/:jobId`                           | `jobs`           |
| `GET`    | `/api/v1/me`                                    | `users`          |
| `PATCH`  | `/api/v1/me`                                    | `users`          |
| `GET`    | `/api/v1/me/applications`                       | `applications`   |
| `POST`   | `/api/v1/me/applications`                       | `applications`   |
| `PATCH`  | `/api/v1/me/applications/:applicationId`        | `applications`   |
| `PATCH`  | `/api/v1/me/applications/:applicationId/status` | `applications`   |
| `GET`    | `/api/v1/me/bookmarks`                          | `bookmarks`      |
| `POST`   | `/api/v1/me/bookmarks`                          | `bookmarks`      |
| `DELETE` | `/api/v1/me/bookmarks/:jobId`                   | `bookmarks`      |
| `PUT`    | `/api/v1/me/education`                          | `users`          |
| `PUT`    | `/api/v1/me/experience`                         | `users`          |
| `GET`    | `/api/v1/me/preferences`                        | `preferences`    |
| `PATCH`  | `/api/v1/me/preferences`                        | `preferences`    |
| `PUT`    | `/api/v1/me/preferences`                        | `preferences`    |
| `PUT`    | `/api/v1/me/profile-photo`                      | `users`          |
| `PUT`    | `/api/v1/me/skills`                             | `users`          |
| `GET`    | `/health/live`                                  | `health`         |
| `GET`    | `/health/ready`                                 | `health`         |
