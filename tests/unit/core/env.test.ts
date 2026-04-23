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
      ENABLE_REQUEST_LOGGING: "true"
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
        CORS_ORIGINS: "*"
      })
    ).toThrow(ZodError);
  });
});
