import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

import {
  buildSyncReadinessReport,
  listServiceDocFiles,
  renderSyncReadinessMarkdown
} from "@/shared/docs/documentation-tooling";

const generatedAt = new Date().toISOString();
const sourceCommit = process.env.SOURCE_SHA ?? "unknown";
const outputPath = path.join(process.cwd(), "docs/generated/sync-readiness.md");
const docPaths = await listServiceDocFiles();
const report = buildSyncReadinessReport(docPaths);
const markdown = await format(
  renderSyncReadinessMarkdown(report, generatedAt, sourceCommit),
  {
    parser: "markdown"
  }
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, markdown, "utf8");

console.log(
  "Generated sync readiness report at docs/generated/sync-readiness.md"
);
