import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

process.env.APP_ENV = "test";
process.env.NODE_ENV = "test";
process.env.MODEL_API_ENABLE_MOCK = "true";
process.env.MODEL_API_SERVICE_TOKEN = "docs-generation-token";

const { loadEnv } = await import("@/config/env");
const { buildOpenApiDocument } = await import("@/shared/docs/openapi");

const config = loadEnv(process.env);
const outputPath = path.join(process.cwd(), "docs/generated/openapi.json");
const document = buildOpenApiDocument(config);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.log("Generated docs/generated/openapi.json");
