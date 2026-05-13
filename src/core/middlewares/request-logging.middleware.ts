import type { RequestHandler } from "express";

import { logger } from "@/config/logger";
import type { RequestLogger } from "@/core/middlewares/request-logging.types";

export function requestLoggingMiddleware(
  requestLogger: RequestLogger = logger
): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();

    res.on("finish", () => {
      requestLogger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
          userId: getUserId(req),
          errorCode: getErrorCode(res)
        },
        "HTTP request completed"
      );
    });

    next();
  };
}

function getUserId(req: Parameters<RequestHandler>[0]) {
  const authContext = req as {
    user?: { id?: unknown };
    auth?: { userId?: unknown };
  };

  if (typeof authContext.auth?.userId === "string") {
    return authContext.auth.userId;
  }

  if (typeof authContext.user?.id === "string") {
    return authContext.user.id;
  }

  return null;
}

function getErrorCode(res: Parameters<RequestHandler>[1]) {
  const errorCode: unknown = res.locals.errorCode;

  return typeof errorCode === "string" ? errorCode : null;
}
