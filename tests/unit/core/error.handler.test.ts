import { afterEach, describe, expect, test } from "bun:test";
import express from "express";

import { logger } from "@/config/logger";
import { BadRequestError } from "@/core/errors/app.error";
import { errorHandler } from "@/core/errors/error.handler";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("errorHandler", () => {
  const originalWarn = logger.warn;

  afterEach(() => {
    logger.warn = originalWarn;
  });

  test("redacts sensitive error details in API responses and logs", async () => {
    const entries: unknown[] = [];
    const warnOverride = ((
      fields: object,
      message?: string,
      ...args: unknown[]
    ) => {
      void args;
      entries.push({ fields, message });
    }) as typeof logger.warn;
    logger.warn = warnOverride;

    const app = express();
    const config = testConfig();

    app.use(requestIdMiddleware(config));
    app.get("/failure", (_req, _res, next) => {
      next(
        new BadRequestError("Unsafe details", "UNSAFE_DETAILS", {
          password: "plain-password",
          accessToken: "secret-token",
          nested: {
            rawCv: "private cv text",
            safeField: "kept"
          }
        })
      );
    });
    app.use(errorHandler);

    const response = await injectRoute(app, {
      url: "/failure",
      headers: { "x-request-id": "req_error_redaction" }
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNSAFE_DETAILS",
        requestId: "req_error_redaction",
        details: {
          password: "[REDACTED]",
          accessToken: "[REDACTED]",
          nested: {
            rawCv: "[REDACTED]",
            safeField: "kept"
          }
        }
      }
    });

    const serializedLog = JSON.stringify(entries);
    expect(serializedLog).not.toContain("plain-password");
    expect(serializedLog).not.toContain("secret-token");
    expect(serializedLog).not.toContain("private cv text");
  });
});
