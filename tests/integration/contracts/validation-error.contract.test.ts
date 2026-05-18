import { describe, expect, test } from "bun:test";
import express from "express";

import { errorHandler } from "@/core/errors/error.handler";
import { requestIdMiddleware } from "@/core/middlewares/request-id.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { successResponse } from "@/core/responses/response.formatter";
import { registerSchema } from "@/modules/auth/auth.schema";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("validation error contracts", () => {
  test("keeps envelope compatibility and field-level details for register payload", async () => {
    const app = createValidationHarnessApp();
    const response = await injectRoute(app, {
      method: "POST",
      url: "/contract/auth/register",
      headers: {
        "x-request-id": "req_contract_register_validation"
      },
      body: {
        username: "A",
        email: "invalid-email",
        phoneNumber: "08123",
        password: "weak",
        confirmPassword: "different"
      }
    });

    expect(response.status).toBe(422);

    const body = response.body as {
      success: boolean;
      message: string;
      data: unknown;
      error: {
        code: string;
        requestId: string;
        details: unknown;
      };
    };

    expect(body.success).toBe(false);
    expect(body.message).toBe("Validasi gagal");
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.requestId).toBe("req_contract_register_validation");
    expect(Array.isArray(body.error.details)).toBe(true);

    const details = body.error.details;
    if (!Array.isArray(details)) {
      throw new Error("Expected validation details array.");
    }

    for (const detail of details) {
      expect(typeof detail).toBe("object");
      expect(detail).not.toBeNull();

      if (typeof detail !== "object" || detail === null) {
        continue;
      }

      const candidate = detail as {
        path?: unknown;
        message?: unknown;
        code?: unknown;
      };
      expect(typeof candidate.path).toBe("string");
      expect(typeof candidate.message).toBe("string");
      expect(typeof candidate.code).toBe("string");
    }

    const hasEmailFriendlyMessage = details.some((detail) => {
      if (typeof detail !== "object" || detail === null) {
        return false;
      }

      const candidate = detail as { path?: unknown; message?: unknown };
      return (
        candidate.path === "email" &&
        candidate.message ===
          "Email tidak valid. Gunakan format email lengkap, contoh nama@domain.com"
      );
    });
    expect(hasEmailFriendlyMessage).toBe(true);
  });

  test("rejects generic validation detail messages in register payload response", async () => {
    const app = createValidationHarnessApp();
    const response = await injectRoute(app, {
      method: "POST",
      url: "/contract/auth/register",
      body: {
        username: "A",
        email: "invalid-email",
        phoneNumber: "08123",
        password: "weak",
        confirmPassword: "different"
      }
    });

    const details = (
      response.body as {
        error: { details: unknown };
      }
    ).error.details;

    expect(Array.isArray(details)).toBe(true);
    if (!Array.isArray(details)) {
      throw new Error("Expected validation details array.");
    }

    const forbiddenMessagePattern =
      /^(Format tidak valid|Nilai terlalu kecil|Nilai terlalu besar|Invalid input|Invalid email address)$/i;

    const hasForbiddenMessage = details.some((detail) => {
      if (typeof detail !== "object" || detail === null) {
        return false;
      }

      const candidate = detail as { message?: unknown };
      return (
        typeof candidate.message === "string" &&
        forbiddenMessagePattern.test(candidate.message)
      );
    });

    expect(hasForbiddenMessage).toBe(false);
  });
});

function createValidationHarnessApp() {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware(testConfig()));
  app.post(
    "/contract/auth/register",
    validate({ body: registerSchema }),
    (_req, res) => {
      res.status(201).json(
        successResponse(
          {
            accepted: true
          },
          "Kontrak validasi lulus",
          null
        )
      );
    }
  );
  app.use(errorHandler);

  return app;
}
