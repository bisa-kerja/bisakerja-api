import { describe, expect, test } from "bun:test";
import express from "express";

import { BadRequestError } from "@/core/errors/app.error";
import { errorHandler } from "@/core/errors/error.handler";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { requestLoggingMiddleware } from "@/core/middlewares/request-logging.middleware";
import { successResponse } from "@/core/responses/response.formatter";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("requestLoggingMiddleware", () => {
  test("logs a request summary without sensitive body fields", async () => {
    const entries: unknown[] = [];
    const app = express();
    const config = testConfig();

    app.use(express.json());
    app.use(requestIdMiddleware(config));
    app.use(
      requestLoggingMiddleware({
        info: (fields: unknown, message?: string) => {
          entries.push({ fields, message });
        }
      })
    );
    app.post("/login", (_req, res) => {
      res.json(successResponse({ ok: true }));
    });

    const response = await injectRoute(app, {
      method: "POST",
      url: "/login?token=secret-query-token",
      headers: {
        "x-request-id": "req_log_123",
        Authorization: "Bearer secret-header-token",
        Cookie: "session=secret-cookie"
      },
      body: {
        email: "user@example.test",
        password: "secret-password",
        accessToken: "secret-token"
      }
    });

    expect(response.status).toBe(200);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as {
      fields: Record<string, unknown>;
      message?: string;
    };
    expect(entry.message).toBe("HTTP request completed");
    expect(entry.fields).toMatchObject({
      requestId: "req_log_123",
      method: "POST",
      path: "/login",
      statusCode: 200,
      userId: null,
      errorCode: null
    });

    const serializedLog = JSON.stringify(entries[0]);
    expect(serializedLog).not.toContain("secret-password");
    expect(serializedLog).not.toContain("secret-token");
    expect(serializedLog).not.toContain("secret-query-token");
    expect(serializedLog).not.toContain("secret-header-token");
    expect(serializedLog).not.toContain("secret-cookie");
  });

  test("includes error code when the error handler maps a failure", async () => {
    const entries: unknown[] = [];
    const app = express();
    const config = testConfig();

    app.use(requestIdMiddleware(config));
    app.use(
      requestLoggingMiddleware({
        info: (fields: unknown, message?: string) => {
          entries.push({ fields, message });
        }
      })
    );
    app.get("/bad", (_req, _res, next) => {
      next(new BadRequestError("Invalid request", "INVALID_REQUEST"));
    });
    app.use(errorHandler);

    const response = await injectRoute(app, {
      url: "/bad",
      headers: {
        "x-request-id": "req_log_error"
      }
    });

    expect(response.status).toBe(400);
    const entry = entries[0] as {
      fields: Record<string, unknown>;
      message?: string;
    };
    expect(entry.message).toBe("HTTP request completed");
    expect(entry.fields).toMatchObject({
      requestId: "req_log_error",
      method: "GET",
      path: "/bad",
      statusCode: 400,
      errorCode: "INVALID_REQUEST"
    });
  });
});
