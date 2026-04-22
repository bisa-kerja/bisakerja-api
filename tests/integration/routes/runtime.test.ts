import { EventEmitter } from "node:events";

import { describe, expect, test } from "bun:test";
import express from "express";
import type { Express } from "express";
import { createRequest, createResponse } from "node-mocks-http";
import { z } from "zod";

import { createApp } from "@/app";
import { errorHandler } from "@/core/errors/error.handler";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { successResponse } from "@/core/responses/response.formatter";
import { testConfig } from "../../helpers/config";

type InjectOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
};

type InjectResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

async function inject(app: Express, options: InjectOptions) {
  const req = createRequest({
    method: options.method ?? "GET",
    url: options.url,
    headers: options.headers,
    body: options.body
  });
  const res = createResponse({
    eventEmitter: EventEmitter
  });

  await new Promise<void>((resolve, reject) => {
    res.on("end", resolve);
    res.on("error", reject);
    const expressApp = app as unknown as {
      handle: (request: typeof req, response: typeof res) => void;
    };
    expressApp.handle(req, res);
  });

  const rawBody = res._getData() as string;

  return {
    status: res.statusCode,
    headers: res._getHeaders(),
    body: rawBody ? (JSON.parse(rawBody) as unknown) : null
  } satisfies InjectResponse;
}

describe("runtime routes and middleware", () => {
  test("returns liveness envelope and generates request id", async () => {
    const response = await inject(createApp(testConfig()), {
      url: "/health/live"
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toStartWith("req_");
    expect(response.body).toEqual({
      success: true,
      message: "Service is live",
      data: {
        service: "bisakerja-api",
        status: "live",
        env: "test"
      },
      meta: null
    });
  });

  test("propagates a valid incoming request id", async () => {
    const response = await inject(createApp(testConfig()), {
      url: "/health/live",
      headers: {
        "x-request-id": "req_client_123"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("req_client_123");
  });

  test("returns standard not found error with request id", async () => {
    const response = await inject(createApp(testConfig()), {
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
    const response = await inject(createApp(testConfig()), {
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
    const response = await inject(createApp(testConfig()), {
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

    const response = await inject(app, {
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

    const first = await inject(app, {
      url: "/health/live",
      headers: {
        "x-request-id": "req_limit_1"
      }
    });
    const second = await inject(app, {
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

    const response = await inject(app, {
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
          path: "",
          code: "unrecognized_keys"
        })
      ])
    );
  });
});
