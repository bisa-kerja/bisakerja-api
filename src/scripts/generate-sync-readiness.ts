import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

import {
  buildSyncReadinessReport,
  listGeneratedDocArtifacts,
  listServiceDocFiles,
  renderSyncReadinessMarkdown
} from "@/shared/docs/documentation-tooling";

const generatedAt = new Date().toISOString();
const sourceCommit = resolveSourceCommit();
const outputPath = path.join(process.cwd(), "docs/generated/sync-readiness.md");
const docPaths = await listServiceDocFiles();
const generatedArtifacts = await listGeneratedDocArtifacts();
const report = buildSyncReadinessReport([...docPaths, ...generatedArtifacts]);
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

function resolveSourceCommit() {
  const envCommit = process.env.SOURCE_SHA?.trim();

  if (envCommit) {
    return envCommit;
  }

  const result = Bun.spawnSync({
    cmd: ["git", "rev-parse", "HEAD"],
    stdout: "pipe",
    stderr: "ignore"
  });
  const gitCommit = result.stdout.toString().trim();

  if (result.exitCode === 0 && gitCommit) {
    return gitCommit;
  }

  throw new Error(
    "SOURCE_SHA is required when git metadata is unavailable."
  );
}
