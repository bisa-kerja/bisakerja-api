import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

process.env.APP_ENV = "test";
process.env.NODE_ENV = "test";
process.env.MODEL_API_ENABLE_MOCK = "true";
process.env.MODEL_API_SERVICE_TOKEN = "docs-generation-token";
process.env.SCRAPER_API_SERVICE_TOKEN = "docs-generation-token";

const { loadEnv } = await import("@/config/env");
const { buildOpenApiDocument } = await import("@/shared/docs/openapi");

const config = loadEnv(process.env);
const outputPath = path.join(process.cwd(), "docs/generated/openapi.json");
const document = buildOpenApiDocument(config);
const contents = await format(JSON.stringify(document), {
  parser: "json"
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, contents, "utf8");

console.log("Generated docs/generated/openapi.json");
