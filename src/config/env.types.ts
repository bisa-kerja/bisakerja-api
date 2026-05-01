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
  auth: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtl: string;
    refreshTokenTtl: string;
    passwordResetTokenTtl: string;
    emailVerificationOtpTtl: string;
    refreshCookieName: string;
    cookieSecure: boolean;
    cookieSameSite: "lax" | "strict" | "none";
    issuer: string;
    audience: string;
  };
  email: {
    provider: "fake" | "resend";
    from: string;
    resend: {
      apiKey: string;
      maxRetries: number;
    };
  };
  asyncWorkloads: {
    redisUrl: string;
    queueName: string;
    queuePrefix: string;
    workerConcurrency: number;
    maxAttempts: number;
    backoffMs: number;
    recoveryBatchSize: number;
    recoveryIntervalMs: number;
  };
  integrations: {
    modelApi: {
      baseUrl: string;
      timeoutMs: number;
      serviceToken: string;
      enableMock: boolean;
    };
    scraperApi: {
      serviceToken: string;
    };
  };
  uploads: {
    fileStorageDriver: "local";
    storagePath: string;
    cvUploadMaxBytes: number;
    cvAllowedMimeTypes: string[];
    cvRetentionDays: number;
  };
  jobs: {
    staleAfterHours: number;
  };
  database: {
    runtimeUrl: string;
    directUrl: string;
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
