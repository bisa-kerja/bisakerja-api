import cors from "cors";
import helmet from "helmet";
import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import { AuthorizationError } from "@/core/errors/app.error";

export function securityHeadersMiddleware(): RequestHandler {
  return helmet();
}

export function corsMiddleware(config: AppConfig): RequestHandler {
  const allowedOrigins = new Set(config.security.corsOrigins);

  return cors({
    credentials: true,
    exposedHeaders: [config.observability.requestIdHeader],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (
        allowedOrigins.has("*") ||
        allowedOrigins.has(origin) ||
        allowedOrigins.has(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }

      callback(
        new AuthorizationError(
          "CORS origin is not allowed",
          "CORS_ORIGIN_NOT_ALLOWED"
        )
      );
    }
  });
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
