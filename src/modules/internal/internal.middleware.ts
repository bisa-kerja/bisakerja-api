import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import { AuthenticationError } from "@/core/errors/app.error";

export function createInternalServiceAuthMiddleware(
  config: AppConfig
): RequestHandler {
  return (req, _res, next) => {
    try {
      const token = extractBearerToken(req.get("authorization"));

      if (!token || token !== config.integrations.scraperApi.serviceToken) {
        throw new AuthenticationError();
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}
