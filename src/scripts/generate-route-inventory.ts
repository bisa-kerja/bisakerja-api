import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";
import type { RequestHandler } from "express";

import type { RouteOptions } from "@/modules";
import type { AsyncJobPublisher } from "@/shared/async-workloads";

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
const routes = listRegisteredRoutes(config, createDocumentationRouteOptions());
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

await closeImportedRuntimeClients();

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

function createDocumentationRouteOptions(): RouteOptions {
  const repository = createInertDependency("repository");
  const authMiddleware: RequestHandler = (_req, _res, next) => {
    next();
  };
  const modelApiClient = createInertDependency("modelApiClient");
  const storage = createInertDependency("storage");

  return {
    aiCvAnalyzer: {
      authMiddleware,
      modelApiClient,
      repository,
      storage
    },
    applications: {
      authMiddleware,
      repository
    },
    auth: {
      authMiddleware,
      jobPublisher: createInertJobPublisher(),
      repository
    },
    bookmarks: {
      authMiddleware,
      repository
    },
    health: {
      checks: {
        postgresql: () => Promise.resolve(),
        redis: () => Promise.resolve()
      }
    },
    internal: {
      authMiddleware,
      repository
    },
    jobs: {
      authMiddleware,
      repository
    },
    preferences: {
      authMiddleware,
      repository
    },
    users: {
      authMiddleware,
      repository
    }
  } as RouteOptions;
}

function createInertJobPublisher(): AsyncJobPublisher {
  return {
    close: () => Promise.resolve(),
    publish: () => Promise.resolve(),
    publishPending: () => Promise.resolve(0)
  };
}

function createInertDependency(label: string) {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return undefined;
        }

        return () =>
          Promise.reject(
            new Error(
              `Documentation route inventory dependency ${label}.${String(property)} should not be called.`
            )
          );
      }
    }
  );
}

async function closeImportedRuntimeClients() {
  const { prisma } = await import("@/shared/libs/prisma");

  await prisma.$disconnect();
}
