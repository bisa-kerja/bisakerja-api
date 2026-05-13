import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function requestIdMiddleware(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    const headerName = config.observability.requestIdHeader;
    const incoming = req.header(headerName);
    const requestId =
      incoming && REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : `req_${randomUUID()}`;

    req.requestId = requestId;
    res.setHeader(headerName, requestId);

    next();
  };
}
