import pino from "pino";

import { env } from "@/config/env";
import type { AppConfig } from "@/config/env";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "password",
  "*.password",
  "token",
  "*.token",
  "accessToken",
  "refreshToken",
  "*.accessToken",
  "*.refreshToken",
  "otp",
  "*.otp",
  "cvContent",
  "*.cvContent",
  "rawPayload",
  "*.rawPayload",
  "DATABASE_URL",
  "*.DATABASE_URL"
];

export function createLogger(config: AppConfig = env) {
  return pino({
    level: config.observability.logLevel,
    base: {
      service: config.app.name,
      env: config.app.env
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: redactPaths,
      censor: "[REDACTED]"
    }
  });
}

export const logger = createLogger();
