import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

process.env.APP_ENV = "test";
process.env.NODE_ENV = "test";
process.env.MODEL_API_ENABLE_MOCK = "true";
process.env.MODEL_API_SERVICE_TOKEN = "docs-generation-token";
process.env.SCRAPER_API_SERVICE_TOKEN = "docs-generation-token";

const { loadEnv } = await import("@/config/env");
const { listRegisteredRoutes, renderRouteInventoryMarkdown } =
  await import("@/shared/docs/route-inventory");

const config = loadEnv(process.env);
const generatedAt = new Date().toISOString();
const sourceCommit = resolveSourceCommit();
const outputPath = path.join(process.cwd(), "docs/generated/routes.md");
const routes = listRegisteredRoutes(config);
const markdown = await format(
  renderRouteInventoryMarkdown(routes, generatedAt, sourceCommit),
  {
    parser: "markdown"
  }
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, markdown, "utf8");

console.log(
  `Generated ${String(routes.length)} routes at docs/generated/routes.md`
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
