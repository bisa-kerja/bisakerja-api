import { describe, expect, test } from "bun:test";

import { testConfig } from "../../helpers/config";
import { buildOpenApiDocument } from "@/shared/docs/openapi";
import { listRegisteredRoutes } from "@/shared/docs/route-inventory";

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
  };
};

describe("openapi document", () => {
  test("covers all registered runtime API routes", () => {
    const config = testConfig();
    const document = buildOpenApiDocument(config) as OpenApiDocument;
    const registeredRoutes = listRegisteredRoutes(config);
    const openApiOperations = new Set(
      Object.entries(document.paths).flatMap(([path, operations]) =>
        Object.keys(operations).map(
          (method) => `${method.toUpperCase()} ${path}`
        )
      )
    );

    for (const route of registeredRoutes) {
      const normalizedPath = route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      expect(openApiOperations.has(`${route.method} ${normalizedPath}`)).toBe(
        true
      );
    }
  });

  test("publishes bearer and refresh-cookie security schemes", () => {
    const document = buildOpenApiDocument(testConfig()) as OpenApiDocument;

    expect(document.openapi).toBe("3.1.0");
    expect(document.components.securitySchemes).toHaveProperty("bearerAuth");
    expect(document.components.securitySchemes).toHaveProperty(
      "refreshTokenCookie"
    );
  });
});
