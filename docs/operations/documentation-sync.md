---
title: Backend API Documentation Sync
description: Source metadata, central sync targets, validation, generated docs, conflict handling, rollback, and reference consistency rules for Backend API service-owned docs.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/operations/documentation-sync.md
last_reviewed: 2026-04-24
---

# Backend API Documentation Sync

This document defines how service-owned documentation from the Bisakerja Backend API repository should be synchronized into the central Bisakerja Docs project.

The Backend API repository remains the source of truth for backend-specific implementation docs. The central docs repository owns platform overviews, shared standards, service landing pages, and cross-service navigation.

## Sync Scope

Only files under this repository's `docs/**` tree are eligible for automatic service documentation sync.

| Source                  | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Stable service alias    | `backend-api`                                      |
| Source repository       | `backend-api`                                      |
| Source docs root        | `docs/**`                                          |
| Latest central target   | `docs/services/backend-api/synced/**`              |
| Release snapshot target | `docs/services/backend-api/versioned/<release>/**` |
| Central landing page    | `docs/services/backend-api/index.mdx`              |

The central landing page is owned by the central docs repository and must never be overwritten by service sync. Service docs must publish only into `synced/**` or `versioned/<release>/**` under the Backend API service subtree.

## Sync Modes

| Mode                     | Trigger                                  | Target                                             | Purpose                              |
| ------------------------ | ---------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| Merge sync               | Merge to the Backend API default branch  | `docs/services/backend-api/synced/**`              | Keep latest backend docs fresh       |
| Release sync             | Backend API release tag or release event | `docs/services/backend-api/versioned/<release>/**` | Capture stable release documentation |
| Scheduled reconciliation | Central docs scheduler                   | Report or refresh `synced/**` state                | Detect drift and retry failed syncs  |

Merge sync should be the default path for daily documentation updates. Release sync should be enabled when backend contracts or operations need release-specific historical evidence.

Current branch rule:

- Source updates may originate from either `develop` or `main` in this repository.
- Automatic sync to the central docs repository must always push into the destination branch `develop`.
- Automatic sync must never target the destination branch `main`.

## Required Frontmatter

Every service-owned doc that can be synced must include:

| Field           | Rule                                                       |
| --------------- | ---------------------------------------------------------- |
| `title`         | Reader-facing page title                                   |
| `description`   | Short summary for navigation and search                    |
| `owner`         | Backend owner or accountable role                          |
| `reviewers`     | Platform docs maintainer and relevant engineering reviewer |
| `doc_status`    | `draft`, `active`, `deprecated`, or `archived`             |
| `source_repo`   | `backend-api`                                              |
| `source_path`   | Original path in this repository                           |
| `last_reviewed` | Most recent meaningful review date                         |

Rules:

- Preserve `source_repo` and `source_path` during sync.
- Do not strip or rewrite owner metadata.
- Keep `source_path` equal to the file path in the Backend API repository.
- Generated docs must include metadata that identifies them as generated either in frontmatter or in the sync manifest.
- Central docs may add pipeline metadata in the manifest or commit history, but it should not remove service ownership.

## Expected Sync Bundle

The future sync pipeline should produce a bundle similar to:

```text
sync-bundle/
  manifest.json
  docs/
  assets/
```

Recommended `manifest.json` fields:

```json
{
  "service": "backend-api",
  "source_repo": "backend-api",
  "source_ref": "main",
  "source_sha": "0000000000000000000000000000000000000000",
  "generated_at": "2026-04-22T00:00:00Z",
  "sync_mode": "merge",
  "doc_count": 24,
  "asset_count": 0
}
```

Manifest rules:

- `service` must equal the stable service alias `backend-api`.
- `sync_mode` must be one of `merge`, `release`, or `scheduled-reconcile`.
- `source_sha` must identify the exact source revision used to build the bundle.
- `doc_count` and `asset_count` must match bundle contents.
- Release bundles should include a release identifier through `source_ref`, target path, or additional manifest metadata.

## Path Mapping

Path mapping must be deterministic.

| Source path                     | Latest central path                                         |
| ------------------------------- | ----------------------------------------------------------- |
| `docs/overview.md`              | `docs/services/backend-api/synced/overview.md`              |
| `docs/modules/auth.md`          | `docs/services/backend-api/synced/modules/auth.md`          |
| `docs/operations/deployment.md` | `docs/services/backend-api/synced/operations/deployment.md` |
| `docs/future/mentoring.md`      | `docs/services/backend-api/synced/future/mentoring.md`      |

Rules:

- Keep relative directory structure under `docs/**`.
- Reject any source path that resolves outside the Backend API service subtree.
- Do not publish service files to central `docs/services/backend-api/index.mdx`.
- Do not publish service files to central overview, standards, or shared reference paths.
- Do not rename files during sync unless the sync manifest records the transformation.

## Validation Checks

The service repo should validate docs before publishing a sync bundle.

Minimum service-side checks:

- All required files exist for the current implementation scope.
- Required frontmatter fields are present.
- `source_repo` is `backend-api`.
- `source_path` matches the actual source path.
- Markdown code fences are closed.
- JSON examples parse when a block is marked as `json`.
- Local relative links point to existing docs or documented central targets.
- No sensitive secrets, tokens, raw CV content, or production credentials are present.
- Generated docs are identified clearly.

Current repository commands:

- `bun run docs:generate:openapi` writes `docs/generated/openapi.json` from the canonical OpenAPI source used by the runtime Scalar reference.
- `bun run docs:generate:routes` writes `docs/generated/routes.md` from the runtime route registry.
- `bun run docs:generate:sync-readiness` writes `docs/generated/sync-readiness.md` from the current `docs/**` tree and sync target rules.
- `bun run docs:check` validates frontmatter and parses all fenced `json` examples under `docs/**`.
- `bun run docs:scalar:check-config` validates `scalar.config.json` through the Scalar CLI.
- `bun run docs:scalar:preview` starts a local Scalar Docs preview using `scalar.config.json`.

Current repository automation:

- `.github/workflows/ci.yml` runs on push to `develop` and `main`, plus pull requests targeting those branches.
- The `CI` workflow regenerates documentation artifacts and generates the Prisma client before static analysis or docs validation so clean runners have the required generated types.
- The `CI` workflow fails if the committed `docs/generated/openapi.json` artifact is stale.
- The generated OpenAPI JSON artifact should be emitted with repository Prettier formatting so documentation validation and formatting checks do not disagree.
- Route inventory and sync-readiness markdown are regenerated for validation and publishing, but they are not clean-tree gates because they intentionally include generation metadata.
- The final `sync-docs` job inside `CI` runs only for push events to `develop` or `main`, and only after the validation jobs pass.
- Cross-repository docs sync happens only after the validated `CI` jobs pass.

Repository-level Scalar Docs configuration lives in `scalar.config.json`. It is not part of the `docs/**` sync payload itself, but it acts as the site map for previewing or publishing the same backend docs set through Scalar Docs using repo-managed files.

The central repository should validate:

- Service alias is recognized.
- Target paths stay inside `docs/services/backend-api/synced/**` or `docs/services/backend-api/versioned/<release>/**`.
- No service bundle overwrites `docs/services/backend-api/index.mdx`.
- Required metadata is still present after sync.
- Asset references resolve after path mapping.
- No duplicate target paths exist.
- Central docs build and broken-link checks pass.

## Generated Docs Strategy

Generated API references should be treated as service-owned docs but clearly marked as generated.

Recommended generated docs placement:

| Generated content      | Source placement                   | Central placement                                              |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------- |
| OpenAPI JSON           | `docs/generated/openapi.json`      | `docs/services/backend-api/synced/generated/openapi.json`      |
| OpenAPI Markdown       | `docs/generated/openapi.md`        | `docs/services/backend-api/synced/generated/openapi.md`        |
| Prisma model reference | `docs/generated/prisma-models.md`  | `docs/services/backend-api/synced/generated/prisma-models.md`  |
| Route inventory        | `docs/generated/routes.md`         | `docs/services/backend-api/synced/generated/routes.md`         |
| Sync readiness report  | `docs/generated/sync-readiness.md` | `docs/services/backend-api/synced/generated/sync-readiness.md` |

Generated docs rules:

- Generated docs must not replace hand-authored architecture, module, security, or operations docs.
- Generated docs must be reproducible from committed source or documented generation commands.
- Generated docs should include generation timestamp, source commit, and generator name in metadata or manifest.
- Generated docs must follow the same no-secret and no-sensitive-payload rules as hand-authored docs.
- If generated docs disagree with hand-authored API contracts, the mismatch must block release until resolved.
- Interactive API documentation should be generated from the same canonical OpenAPI source once that source is finalized, rather than maintained as a separate manual artifact.

## Asset Handling

The current Backend API docs are text-only. If diagrams or assets are added later:

- Store assets near the docs that use them or in a documented `docs/assets/**` subtree.
- Use service-prefixed asset names when a generic name could collide.
- Copy only referenced assets into the sync bundle.
- Preserve relative links where possible.
- Reject unresolved or ambiguous asset paths.

## Conflict Handling

Conflicts must fail validation instead of silently overwriting central docs.

| Conflict                                             | Expected behavior                     |
| ---------------------------------------------------- | ------------------------------------- |
| Service bundle targets central landing page          | Reject sync                           |
| Path escapes Backend API subtree                     | Reject sync                           |
| Duplicate target path inside bundle                  | Reject sync                           |
| Missing `source_repo` or `source_path`               | Reject sync                           |
| Service alias differs from source metadata           | Reject sync                           |
| Asset collision cannot be resolved deterministically | Reject sync                           |
| Generated and hand-authored docs disagree            | Block release or require owner review |

Central landing pages always win over service bundles.

## Last-Known-Good Rollback

Documentation sync should behave like a controlled publish.

Rules:

- Apply each accepted sync as an atomic central change.
- Keep the previous successful central state as the last-known-good target.
- If validation fails before publish, keep central docs unchanged.
- If a bad sync is published, revert the sync commit or restore the last-known-good bundle.
- Do not require the Backend API team to regenerate an old bundle before central docs can roll back.
- Record failure reason and owning service in the sync report.

Rollback should preserve the central service landing page and any other central-owned content.

## GitHub Repository Requirements

The current cross-repository sync workflow expects:

- source repository: `bisa-kerja/bisakerja-api`
- destination repository: `bisa-kerja/bisakerja-docs`
- destination path root: `docs/services/backend-api/synced/**`
- destination branch: `develop`
- GitHub secret: `DOCS_REPO_TOKEN`

`DOCS_REPO_TOKEN` should grant only the repository access needed to push synchronized service documentation into `bisakerja-docs`.

## Review And Freshness

Service-owned docs should be reviewed:

- Before backend implementation starts.
- Before a milestone handoff.
- Before a release sync.
- After API, database, auth, security, or integration behavior changes.
- After an incident reveals a documentation gap.

`last_reviewed` should be updated after meaningful review, not after mechanical formatting only.

## Reference Consistency Task

Reference consistency review should be scoped to documents affected by the implementation rather than broad central docs rewrites.

Current review result:

- `references/docs/standards/service-documentation-integration.mdx` already defines `backend-api` source root and central target consistently.
- `references/docs/standards/documentation-sync-and-versioning.mdx` already defines `synced/**`, `versioned/<release>/**`, validation, conflict handling, and last-known-good behavior consistently.
- `references/docs/services/backend-api/index.mdx` remains accurate because central synchronized Backend API content has not been published yet.
- No central landing page should be overwritten by service docs.

Follow-up task after service docs mature:

1. Confirm `docs/services/backend-api/index.mdx` in the central docs project links to the synced Backend API pages.
2. Confirm the central pre-sync gap assessment reflects the actual service docs status.
3. Confirm generated OpenAPI and Prisma references, if added, are routed under `synced/generated/**`.
4. Confirm central navigation exposes service docs without duplicating ownership.
5. Confirm any central changes are made in the central docs repository or an approved sync pipeline, not by copying service docs into unrelated paths.

## Release Readiness Impact

The Backend API documentation set is sync-ready when:

- Required service docs exist under `docs/**`.
- Frontmatter metadata is complete.
- API examples and generated docs validate.
- The sync bundle can map all files into allowed central paths.
- No service docs overwrite central landing pages.
- Last-known-good rollback expectations are documented.
- Future-scope docs are clearly marked as non-MVP.

## Related Docs

- `docs/overview.md`
- `docs/api-reference.md`
- `docs/operations/deployment.md`
- `docs/operations/testing.md`
- `references/docs/standards/service-documentation-integration.mdx`
- `references/docs/standards/documentation-sync-and-versioning.mdx`
- `references/docs/standards/metadata-standard.mdx`
