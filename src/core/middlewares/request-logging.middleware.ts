import type { RequestHandler } from "express";

import { logger } from "@/config/logger";

export function requestLoggingMiddleware(): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();

    res.on("finish", () => {
      logger.info({
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt)
      });
    });

    next();
  };
}
