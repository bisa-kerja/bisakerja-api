import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import { AuthenticationError } from "@/core/errors/app.error";
import { PrismaAuthRepository, type AuthRepository } from "@/modules/auth";
import { verifyAccessToken } from "@/shared/utils/jwt";

export type AuthMiddlewareOptions = {
  allowUnverifiedEmail?: boolean;
};

export function createAuthMiddleware(
  config: AppConfig,
  repository: AuthRepository = new PrismaAuthRepository(),
  options: AuthMiddlewareOptions = {}
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = extractBearerToken(req.get("authorization"));

      if (!token) {
        throw new AuthenticationError();
      }

      const payload = verifyAccessToken(config, token);

      if (!payload) {
        throw new AuthenticationError();
      }

      const user = await repository.findUserById(payload.sub);

      if (
        user?.status !== "ACTIVE" ||
        (!options.allowUnverifiedEmail && !user.emailVerified)
      ) {
        throw new AuthenticationError();
      }

      req.auth = {
        userId: user.id,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          emailVerified: user.emailVerified,
          onboardingStatus: user.onboardingStatus,
          createdAt: user.createdAt
        }
      };

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
