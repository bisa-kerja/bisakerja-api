import pino from "pino";

import { loadEnv } from "@/config/env";
import type { AppConfig } from "@/config/env";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "password",
  "*.password",
  "secret",
  "*.secret",
  "credential",
  "*.credential",
  "apiKey",
  "*.apiKey",
  "token",
  "*.token",
  "accessToken",
  "refreshToken",
  "*.accessToken",
  "*.refreshToken",
  "otp",
  "*.otp",
  "rawCv",
  "*.rawCv",
  "cvContent",
  "*.cvContent",
  "rawModel",
  "*.rawModel",
  "rawScraper",
  "*.rawScraper",
  "rawPayload",
  "*.rawPayload",
  "sourcePayload",
  "*.sourcePayload",
  "DATABASE_URL",
  "*.DATABASE_URL",
  "RESEND_API_KEY",
  "*.RESEND_API_KEY"
];

export function createLogger(config: AppConfig) {
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

export const logger = createLogger(loadEnv());
