import { rateLimit } from "express-rate-limit";
import type { RateLimitRequestHandler } from "express-rate-limit";

import type { AppConfig } from "@/config/env";
import { errorResponse } from "@/core/responses/response.formatter";

type RateLimiterSet = {
  defaultLimiter: RateLimitRequestHandler;
  authLimiter: RateLimitRequestHandler;
  uploadLimiter: RateLimitRequestHandler;
  aiLimiter: RateLimitRequestHandler;
};

function createLimiter(
  config: AppConfig,
  limit: number,
  identifier: string
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    limit,
    identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      const requestId = req.requestId;

      res.status(429).json(
        errorResponse("Too many requests", "RATE_LIMITED", requestId, {
          limit: identifier
        })
      );
    }
  });
}

export function createRateLimiters(config: AppConfig): RateLimiterSet {
  return {
    defaultLimiter: createLimiter(
      config,
      config.security.rateLimitMax,
      "default"
    ),
    authLimiter: createLimiter(
      config,
      config.security.authRateLimitMax,
      "auth"
    ),
    uploadLimiter: createLimiter(
      config,
      config.security.uploadRateLimitMax,
      "upload"
    ),
    aiLimiter: createLimiter(config, config.security.aiRateLimitMax, "ai")
  };
}
