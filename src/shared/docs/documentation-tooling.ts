import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type DocumentationIssue = {
  filePath: string;
  message: string;
};

export type SyncReadinessReport = {
  docs: {
    filePath: string;
    targetPath: string;
  }[];
  generatedDocs: string[];
  issues: DocumentationIssue[];
  openApiStatus: "pending_source_selection" | "available";
};

const REQUIRED_FRONTMATTER_FIELDS = [
  "title",
  "description",
  "owner",
  "reviewers",
  "doc_status",
  "source_repo",
  "source_path",
  "last_reviewed"
] as const;

export async function listServiceDocFiles(rootDir = process.cwd()) {
  const docsRoot = path.join(rootDir, "docs");

  return walkMarkdownFiles(docsRoot, rootDir);
}

export async function validateServiceDocs(rootDir = process.cwd()) {
  const files = await listServiceDocFiles(rootDir);
  const issues: DocumentationIssue[] = [];

  for (const filePath of files) {
    const content = await readFile(path.join(rootDir, filePath), "utf8");

    issues.push(...validateFrontmatter(filePath, content));
    issues.push(...validateJsonExamples(filePath, content));
  }

  return {
    files,
    issues
  };
}

export function validateFrontmatter(filePath: string, content: string) {
  const issues: DocumentationIssue[] = [];
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    return [
      {
        filePath,
        message: "Missing frontmatter block at the top of the document."
      }
    ];
  }

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!(field in frontmatter)) {
      issues.push({
        filePath,
        message: `Missing required frontmatter field: ${field}.`
      });
    }
  }

  if (frontmatter.source_repo !== "backend-api") {
    issues.push({
      filePath,
      message: "source_repo must be backend-api."
    });
  }

  if (frontmatter.source_path !== filePath) {
    issues.push({
      filePath,
      message: `source_path must match file path (${filePath}).`
    });
  }

  if (
    !Array.isArray(frontmatter.reviewers) ||
    frontmatter.reviewers.length === 0
  ) {
    issues.push({
      filePath,
      message: "reviewers must be a non-empty list."
    });
  }

  if (
    typeof frontmatter.last_reviewed !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_reviewed)
  ) {
    issues.push({
      filePath,
      message: "last_reviewed must use YYYY-MM-DD format."
    });
  }

  if (filePath.startsWith("docs/generated/")) {
    if (
      typeof frontmatter.generated_by !== "string" ||
      frontmatter.generated_by === ""
    ) {
      issues.push({
        filePath,
        message: "Generated docs must include generated_by."
      });
    }

    if (
      typeof frontmatter.generated_at !== "string" ||
      frontmatter.generated_at === ""
    ) {
      issues.push({
        filePath,
        message: "Generated docs must include generated_at."
      });
    }
  }

  return issues;
}

export function validateJsonExamples(filePath: string, content: string) {
  const issues: DocumentationIssue[] = [];
  const jsonFencePattern = /```json\r?\n([\s\S]*?)\r?\n```/g;
  let match: RegExpExecArray | null = jsonFencePattern.exec(content);

  while (match) {
    const jsonExample = match[1];

    if (typeof jsonExample !== "string") {
      match = jsonFencePattern.exec(content);
      continue;
    }

    try {
      JSON.parse(jsonExample);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown JSON parse error";

      issues.push({
        filePath,
        message: `Invalid JSON example: ${reason}.`
      });
    }

    match = jsonFencePattern.exec(content);
  }

  return issues;
}

export function parseFrontmatter(content: string) {
  const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = frontmatterPattern.exec(content);
  const frontmatterBlock = match?.[1];

  if (!frontmatterBlock) {
    return null;
  }

  const result: Record<string, unknown> = {};
  let activeArrayKey: string | null = null;

  for (const rawLine of frontmatterBlock.split(/\r?\n/)) {
    if (rawLine.trim() === "") {
      continue;
    }

    const arrayMatch = /^\s*-\s+(.*)$/.exec(rawLine);
    const arrayValue = arrayMatch?.[1];

    if (typeof arrayValue === "string" && activeArrayKey) {
      const currentValue = result[activeArrayKey];

      if (Array.isArray(currentValue)) {
        currentValue.push(arrayValue.trim());
      }

      continue;
    }

    const fieldMatch = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(rawLine);

    if (!fieldMatch) {
      activeArrayKey = null;
      continue;
    }

    const key = fieldMatch[1];
    const rawValue = fieldMatch[2];

    if (typeof key !== "string" || typeof rawValue !== "string") {
      activeArrayKey = null;
      continue;
    }

    const value = rawValue.trim();

    if (value === "") {
      result[key] = [];
      activeArrayKey = key;
      continue;
    }

    result[key] = stripWrappingQuotes(value);
    activeArrayKey = null;
  }

  return result;
}

export function buildSyncReadinessReport(
  docPaths: string[]
): SyncReadinessReport {
  const docs = docPaths.map((filePath) => ({
    filePath,
    targetPath: toCentralSyncTarget(filePath)
  }));
  const issues: DocumentationIssue[] = [];
  const seenTargets = new Set<string>();

  for (const doc of docs) {
    if (!doc.targetPath.startsWith("docs/services/backend-api/synced/")) {
      issues.push({
        filePath: doc.filePath,
        message: "Target path escapes the allowed backend-api synced subtree."
      });
    }

    if (doc.targetPath === "docs/services/backend-api/index.mdx") {
      issues.push({
        filePath: doc.filePath,
        message: "Target path would overwrite the central landing page."
      });
    }

    if (seenTargets.has(doc.targetPath)) {
      issues.push({
        filePath: doc.filePath,
        message: `Duplicate central target path detected: ${doc.targetPath}.`
      });
    }

    seenTargets.add(doc.targetPath);
  }

  return {
    docs,
    generatedDocs: docPaths.filter((filePath) =>
      filePath.startsWith("docs/generated/")
    ),
    issues,
    openApiStatus: docPaths.some(
      (filePath) =>
        filePath === "docs/generated/openapi.json" ||
        filePath === "docs/generated/openapi.md"
    )
      ? "available"
      : "pending_source_selection"
  };
}

export function renderSyncReadinessMarkdown(
  report: SyncReadinessReport,
  generatedAt: string,
  sourceCommit: string
) {
  const pathRows = report.docs
    .map((doc) => `| \`${doc.filePath}\` | \`${doc.targetPath}\` |`)
    .join("\n");
  const issueSection =
    report.issues.length === 0
      ? "No sync path conflicts or central landing-page overwrite risks were detected."
      : report.issues
          .map((issue) => `- \`${issue.filePath}\`: ${issue.message}`)
          .join("\n");
  const openApiNote =
    report.openApiStatus === "available"
      ? "A generated OpenAPI artifact is present under `docs/generated/`."
      : "No generated OpenAPI artifact is published yet. The machine-readable API source is still pending final selection, and interactive documentation can be attached later once that source is adopted.";

  return `---
title: Backend API Sync Readiness
description: Generated readiness report for service-doc path mapping, metadata discipline, and central sync safety.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/generated/sync-readiness.md
last_reviewed: ${generatedAt.slice(0, 10)}
generated_by: sync-readiness-script
generated_at: ${generatedAt}
source_commit: ${sourceCommit}
---

# Backend API Sync Readiness

This page is generated from the current service-owned docs tree and the documented central sync target rules.

## Summary

| Metric | Value |
| ------ | ----- |
| Total docs | ${String(report.docs.length)} |
| Generated docs | ${String(report.generatedDocs.length)} |
| Generated at | \`${generatedAt}\` |
| Source commit | \`${sourceCommit}\` |

## OpenAPI Status

${openApiNote}

An interactive API portal can be introduced later from the same machine-readable source, including a Scalar-based presentation if that becomes the chosen documentation surface.

## Path Mapping

| Source | Central target |
| ------ | -------------- |
${pathRows}

## Validation Outcome

${issueSection}
`;
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function toCentralSyncTarget(filePath: string) {
  const normalized = filePath.replaceAll(path.sep, "/");
  const relativePath = normalized.startsWith("docs/")
    ? normalized.slice("docs/".length)
    : normalized;

  return `docs/services/backend-api/synced/${relativePath}`;
}

async function walkMarkdownFiles(
  currentDir: string,
  rootDir: string
): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(absolutePath, rootDir)));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    files.push(path.relative(rootDir, absolutePath).replaceAll(path.sep, "/"));
  }

  return files.sort();
}
