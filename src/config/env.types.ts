import type { z } from "zod";

import type { envSchema } from "@/config/env.schema";

export type AppEnvironment = z.infer<typeof envSchema>["APP_ENV"];

export type AppConfig = {
  app: {
    name: string;
    env: AppEnvironment;
    nodeEnv: "development" | "test" | "production";
    port: number;
    apiPrefix: string;
    appUrl: string;
    frontendUrl: string;
  };
  security: {
    corsOrigins: string[];
    trustProxy: boolean;
    requestBodyLimit: string;
    rateLimitWindowMs: number;
    rateLimitMax: number;
    authRateLimitMax: number;
    uploadRateLimitMax: number;
    aiRateLimitMax: number;
  };
  database: {
    url: string;
    runtimeUrl: string;
    directUrl: string | null;
    prismaLogLevel: "query" | "info" | "warn" | "error";
  };
  observability: {
    logLevel:
      | "fatal"
      | "error"
      | "warn"
      | "info"
      | "debug"
      | "trace"
      | "silent";
    requestIdHeader: string;
    enableRequestLogging: boolean;
    healthCheckTimeoutMs: number;
  };
};
