import { describe, expect, test } from "bun:test";
import { ZodError } from "zod";

import { loadEnv } from "@/config/env";
import { testConfig } from "../../helpers/config";

describe("environment validation", () => {
  test("loads typed application, security, and observability config", () => {
    const config = testConfig({
      PORT: "3100",
      CORS_ORIGINS: "http://localhost:5173,http://localhost:3001",
      TRUST_PROXY: "true",
      ENABLE_REQUEST_LOGGING: "true",
      EMAIL_FROM: "Bisakerja <no-reply@bisakerja.example>",
      MODEL_API_ENABLE_MOCK: "false",
      MODEL_API_SERVICE_TOKEN: "live-model-token"
    });

    expect(config.app.port).toBe(3100);
    expect(config.security.corsOrigins).toEqual([
      "http://localhost:5173",
      "http://localhost:3001"
    ]);
    expect(config.database.runtimeUrl).toContain("bisakerja_api_test");
    expect(config.database.prismaLogLevel).toBe("warn");
    expect(config.security.trustProxy).toBe(true);
    expect(config.observability.enableRequestLogging).toBe(true);
    expect(config.integrations.modelApi.baseUrl).toBe("http://localhost:8000");
    expect(config.integrations.modelApi.timeoutMs).toBe(10000);
    expect(config.integrations.modelApi.serviceToken).toBe("live-model-token");
    expect(config.integrations.modelApi.enableMock).toBe(false);
    expect(config.email.from).toBe("Bisakerja <no-reply@bisakerja.example>");
  });

  test("rejects invalid port values", () => {
    expect(() => testConfig({ PORT: "not-a-number" })).toThrow(ZodError);
  });

  test("rejects wildcard CORS origins in production", () => {
    expect(() =>
      loadEnv({
        APP_ENV: "production",
        NODE_ENV: "production",
        PORT: "3000",
        API_PREFIX: "/api/v1",
        APP_URL: "https://api.bisakerja.example",
        FRONTEND_URL: "https://bisakerja.example",
        CORS_ORIGINS: "*",
        MODEL_API_SERVICE_TOKEN: "prod-model-token"
      })
    ).toThrow(ZodError);
  });

  test("rejects insecure refresh cookie settings", () => {
    expect(() =>
      testConfig({
        AUTH_COOKIE_SAME_SITE: "none",
        AUTH_COOKIE_SECURE: "false"
      })
    ).toThrow(ZodError);

    expect(() =>
      loadEnv({
        APP_ENV: "production",
        NODE_ENV: "production",
        PORT: "3000",
        API_PREFIX: "/api/v1",
        APP_URL: "https://api.bisakerja.example",
        FRONTEND_URL: "https://bisakerja.example",
        CORS_ORIGINS: "https://bisakerja.example",
        AUTH_COOKIE_SECURE: "false",
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "Bisakerja <no-reply@bisakerja.example>",
        RESEND_API_KEY: "re_test_123",
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "prod-model-token"
      })
    ).toThrow(ZodError);
  });

  test("rejects missing resend api key when resend provider is enabled", () => {
    expect(() =>
      testConfig({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: ""
      })
    ).toThrow(ZodError);
  });

  test("rejects missing model api token outside mock mode", () => {
    expect(() =>
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: ""
      })
    ).toThrow(ZodError);
  });
});
