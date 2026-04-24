import { describe, expect, test } from "bun:test";
import express from "express";

import { errorHandler } from "@/core/errors/error.handler";
import {
  corsMiddleware,
  securityHeadersMiddleware
} from "@/core/middlewares/security.middleware";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { successResponse } from "@/core/responses/response.formatter";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("security middleware", () => {
  test("allows configured origins and exposes the request id header", async () => {
    const app = express();
    const config = testConfig({
      CORS_ORIGINS: "https://frontend.example"
    });

    app.use(requestIdMiddleware(config));
    app.use(securityHeadersMiddleware());
    app.use(corsMiddleware(config));
    app.get("/resource", (_req, res) => {
      res.setHeader(config.observability.requestIdHeader, "req_security_ok");
      res.json(successResponse({ ok: true }));
    });
    app.use(errorHandler);

    const response = await injectRoute(app, {
      url: "/resource",
      headers: {
        Origin: "https://frontend.example"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://frontend.example"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-expose-headers"]).toBe(
      config.observability.requestIdHeader
    );
  });

  test("allows the backend app origin for scalar docs requests", async () => {
    const app = express();
    const config = testConfig({
      APP_URL: "http://localhost:3000",
      CORS_ORIGINS: "https://frontend.example"
    });

    app.use(requestIdMiddleware(config));
    app.use(corsMiddleware(config));
    app.get("/resource", (_req, res) => {
      res.json(successResponse({ ok: true }));
    });
    app.use(errorHandler);

    const response = await injectRoute(app, {
      url: "/resource",
      headers: {
        Origin: "http://localhost:3000"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
  });

  test("rejects disallowed origins with a safe error envelope", async () => {
    const app = express();
    const config = testConfig({
      CORS_ORIGINS: "https://frontend.example"
    });

    app.use(requestIdMiddleware(config));
    app.use(corsMiddleware(config));
    app.get("/resource", (_req, res) => {
      res.json(successResponse({ ok: true }));
    });
    app.use(errorHandler);

    const response = await injectRoute(app, {
      url: "/resource",
      headers: {
        Origin: "https://malicious.example",
        "x-request-id": "req_cors_blocked"
      }
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "CORS_ORIGIN_NOT_ALLOWED",
        requestId: "req_cors_blocked"
      }
    });
  });
});
