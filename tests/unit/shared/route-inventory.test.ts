import { describe, expect, test } from "bun:test";

import { testConfig } from "../../helpers/config";
import {
  listRegisteredRoutes,
  renderRouteInventoryMarkdown
} from "@/shared/docs/route-inventory";

describe("route inventory", () => {
  test("lists mounted routes from the runtime registry", () => {
    const routes = listRegisteredRoutes(testConfig());

    expect(routes).toContainEqual({
      moduleId: "health",
      method: "GET",
      path: "/health/live"
    });
    expect(routes).toContainEqual({
      moduleId: "auth",
      method: "POST",
      path: "/api/v1/auth/login"
    });
    expect(routes).toContainEqual({
      moduleId: "jobs",
      method: "GET",
      path: "/api/v1/jobs/:jobId"
    });
    expect(routes).toContainEqual({
      moduleId: "users",
      method: "PUT",
      path: "/api/v1/me/skills"
    });
  });

  test("renders generated markdown with route rows", () => {
    const markdown = renderRouteInventoryMarkdown(
      [
        {
          moduleId: "jobs",
          method: "GET",
          path: "/api/v1/jobs"
        }
      ],
      "2026-04-23T00:00:00.000Z",
      "unknown"
    );

    expect(markdown).toContain("source_path: docs/generated/routes.md");
    expect(markdown).toContain("generated_by: route-inventory-script");
    expect(markdown).toContain("| `GET` | `/api/v1/jobs` | `jobs` |");
  });
});
