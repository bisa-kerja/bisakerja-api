import { describe, expect, test } from "bun:test";
import express from "express";
import { z } from "zod";

import { createApp } from "@/app";
import { errorHandler } from "@/core/errors/error.handler";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { successResponse } from "@/core/responses/response.formatter";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("runtime routes and middleware", () => {
  test("returns liveness envelope and generates request id", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/health/live"
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toStartWith("req_");
    expect(response.body).toEqual({
      success: true,
      message: "Layanan aktif",
      data: {
        service: "bisakerja-api",
        status: "live",
        env: "test"
      },
      meta: null
    });
  });

  test("serves the OpenAPI document", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/openapi.json"
    });
    const body = response.body as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths["/api/v1/jobs"]).toBeDefined();
    expect(body.paths["/api/v1/ai/cv-analyzer"]).toBeDefined();
  });

  test("serves the Scalar API reference page", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/docs/api"
    });
    const body = response.body as string;
    const csp = response.headers["content-security-policy"];

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(body).toContain("@scalar/api-reference");
    expect(body).toContain('url: "/openapi.json"');
    expect(body).toContain("<script nonce=");
    expect(csp).toContain("https://cdn.jsdelivr.net");
    expect(csp).toContain("script-src");
    expect(csp).toContain("nonce-");
  });

  test("propagates a valid incoming request id", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/health/live",
      headers: {
        "x-request-id": "req_client_123"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("req_client_123");
  });

  test("returns standard not found error with request id", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/missing",
      headers: {
        "x-request-id": "req_missing_123"
      }
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
      data: null,
      error: {
        code: "NOT_FOUND",
        details: null,
        requestId: "req_missing_123"
      }
    });
  });

  test("rejects disallowed CORS origins", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/health/live",
      headers: {
        Origin: "https://evil.example",
        "x-request-id": "req_cors_123"
      }
    });

    expect(response.status).toBe(403);
    const body = response.body as { error: unknown };

    expect(body.error).toEqual({
      code: "CORS_ORIGIN_NOT_ALLOWED",
      details: null,
      requestId: "req_cors_123"
    });
  });

  test("sets security headers", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      url: "/health/live"
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("maps payload-too-large parser errors to a 413 envelope", async () => {
    const app = express();
    const config = testConfig();

    app.use(requestIdMiddleware(config));
    app.post("/too-large", (_req, _res, next) => {
      next({ type: "entity.too.large" });
    });
    app.use(errorHandler);

    const response = await injectRoute(app, {
      method: "POST",
      url: "/too-large",
      headers: {
        "x-request-id": "req_body_123"
      }
    });

    expect(response.status).toBe(413);
    const body = response.body as { error: unknown };

    expect(body.error).toEqual({
      code: "PAYLOAD_TOO_LARGE",
      details: null,
      requestId: "req_body_123"
    });
  });

  test("applies default rate limit envelope", async () => {
    const app = createApp(
      testConfig({
        RATE_LIMIT_WINDOW_MS: "60000",
        RATE_LIMIT_MAX: "1"
      })
    );

    const first = await injectRoute(app, {
      url: "/health/live",
      headers: {
        "x-request-id": "req_limit_1"
      }
    });
    const second = await injectRoute(app, {
      url: "/health/live",
      headers: {
        "x-request-id": "req_limit_2"
      }
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      success: false,
      message: "Too many requests",
      data: null,
      error: {
        code: "RATE_LIMITED",
        details: {
          limit: "default"
        },
        requestId: "req_limit_2"
      }
    });
  });

  test("maps Zod validation failures to a 422 envelope", async () => {
    const app = express();
    const config = testConfig();

    app.use(requestIdMiddleware(config));
    app.post(
      "/echo",
      validate({
        body: z.strictObject({
          email: z.email()
        })
      }),
      (req, res) => {
        res.json(successResponse(req.body));
      }
    );
    app.use(errorHandler);

    const response = await injectRoute(app, {
      method: "POST",
      url: "/echo",
      headers: {
        "x-request-id": "req_validation_123"
      },
      body: {
        email: "invalid",
        extra: true
      }
    });

    expect(response.status).toBe(422);
    const body = response.body as {
      success: boolean;
      error: { code: string; requestId: string; details: unknown };
    };

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.requestId).toBe("req_validation_123");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "email",
          code: "invalid_format"
        }),
        expect.objectContaining({
          path: "extra",
          code: "unrecognized_keys"
        })
      ])
    );
  });
});
