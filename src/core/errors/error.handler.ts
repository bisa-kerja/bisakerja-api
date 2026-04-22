import type { ErrorRequestHandler } from "express";

import { AppError, PayloadTooLargeError } from "@/core/errors/app.error";
import { errorResponse } from "@/core/responses/response.formatter";
import { logger } from "@/config/logger";

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isPayloadTooLarge(error)) {
    return new PayloadTooLargeError();
  }

  return new AppError({
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error",
    details: null,
    isOperational: false
  });
}

function isPayloadTooLarge(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.too.large"
  );
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = normalizeError(error);
  const requestId = req.requestId;

  const logMethod = appError.statusCode >= 500 ? "error" : "warn";
  logger[logMethod](
    {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: appError.statusCode,
      errorCode: appError.code,
      errorName: appError.name
    },
    appError.message
  );

  res
    .status(appError.statusCode)
    .json(
      errorResponse(
        appError.message,
        appError.code,
        requestId,
        appError.details
      )
    );
};
