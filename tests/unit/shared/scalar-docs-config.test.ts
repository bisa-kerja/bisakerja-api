import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "bun:test";

type ScalarRoute =
  | {
      type: "page" | "openapi";
      title: string;
      filepath: string;
    }
  | {
      type: "group";
      title: string;
      children: Record<string, ScalarRoute>;
    };

type ScalarConfig = {
  scalar: string;
  info: {
    title: string;
    description: string;
  };
  navigation: {
    routes: Record<string, ScalarRoute>;
  };
};

describe("scalar docs config", () => {
  test("maps repository docs and openapi artifact through scalar.config.json", async () => {
    const rootDir = process.cwd();
    const configPath = path.join(rootDir, "scalar.config.json");
    const config = JSON.parse(
      await readFile(configPath, "utf8")
    ) as ScalarConfig;
    const filepaths = collectFilepaths(config.navigation.routes);
    const apiRoute = config.navigation.routes["/api"];

    expect(config.scalar).toBe("2.0.0");
    expect(config.info.title).toBe("Bisakerja Backend API Docs");
    expect(apiRoute?.type).toBe("openapi");
    if (apiRoute?.type !== "openapi") {
      throw new Error("Expected /api route to be an OpenAPI route");
    }
    expect(apiRoute.filepath).toBe("docs/generated/openapi.json");

    for (const filepath of filepaths) {
      await access(path.join(rootDir, filepath));
    }
  });
});

function collectFilepaths(routes: Record<string, ScalarRoute>): string[] {
  return Object.values(routes).flatMap((route) => {
    if (route.type === "group") {
      return collectFilepaths(route.children);
    }

    return [route.filepath];
  });
}
