import { describe, expect, test } from "bun:test";

import {
  buildSyncReadinessReport,
  parseFrontmatter,
  renderSyncReadinessMarkdown,
  validateFrontmatter,
  validateJsonExamples
} from "@/shared/docs/documentation-tooling";

describe("documentation tooling", () => {
  test("parses frontmatter with list fields", () => {
    const frontmatter = parseFrontmatter(`---
title: Example
description: Example doc
owner: backend-owner
reviewers:
  - reviewer-a
  - reviewer-b
doc_status: draft
source_repo: backend-api
source_path: docs/example.md
last_reviewed: 2026-04-23
---

# Example
`);

    expect(frontmatter).toEqual({
      title: "Example",
      description: "Example doc",
      owner: "backend-owner",
      reviewers: ["reviewer-a", "reviewer-b"],
      doc_status: "draft",
      source_repo: "backend-api",
      source_path: "docs/example.md",
      last_reviewed: "2026-04-23"
    });
  });

  test("validates required metadata and generated metadata rules", () => {
    const issues = validateFrontmatter(
      "docs/generated/routes.md",
      `---
title: Routes
description: Generated routes
owner: backend-owner
reviewers:
  - platform-docs-maintainer
doc_status: draft
source_repo: backend-api
source_path: docs/generated/routes.md
last_reviewed: 2026-04-23
---

# Routes
`
    );

    expect(issues).toEqual([
      {
        filePath: "docs/generated/routes.md",
        message: "Generated docs must include generated_by."
      },
      {
        filePath: "docs/generated/routes.md",
        message: "Generated docs must include generated_at."
      }
    ]);
  });

  test("rejects invalid json examples", () => {
    const issues = validateJsonExamples(
      "docs/example.md",
      `---
title: Example
description: Example doc
owner: backend-owner
reviewers:
  - reviewer-a
doc_status: draft
source_repo: backend-api
source_path: docs/example.md
last_reviewed: 2026-04-23
---

\`\`\`json
{ invalid }
\`\`\`
`
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.filePath).toBe("docs/example.md");
  });

  test("builds sync readiness mapping and renders pending openapi status", () => {
    const report = buildSyncReadinessReport([
      "docs/api-reference.md",
      "docs/generated/routes.md"
    ]);

    expect(report.issues).toEqual([]);
    expect(report.docs).toEqual([
      {
        filePath: "docs/api-reference.md",
        targetPath: "docs/services/backend-api/synced/api-reference.md"
      },
      {
        filePath: "docs/generated/routes.md",
        targetPath: "docs/services/backend-api/synced/generated/routes.md"
      }
    ]);
    expect(report.openApiStatus).toBe("pending_source_selection");

    const markdown = renderSyncReadinessMarkdown(
      report,
      "2026-04-23T00:00:00.000Z",
      "unknown"
    );

    expect(markdown).toContain("source_path: docs/generated/sync-readiness.md");
    expect(markdown).toContain("Scalar-based presentation");
    expect(markdown).toContain(
      "| `docs/api-reference.md` | `docs/services/backend-api/synced/api-reference.md` |"
    );
  });
});
