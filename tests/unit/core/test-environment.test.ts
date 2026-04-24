import { describe, expect, test } from "bun:test";

import { testConfig } from "../../helpers/config";
import { assertIntegrationTestEnvironment } from "../../helpers/test-environment";

describe("integration test environment guard", () => {
  test("accepts test config without a database URL before database tests exist", () => {
    expect(() => {
      assertIntegrationTestEnvironment(testConfig());
    }).not.toThrow();
  });

  test("accepts isolated test database URLs", () => {
    expect(() => {
      assertIntegrationTestEnvironment(testConfig(), {
        databaseUrl:
          "postgresql://app_user:password@ep-test-breeze-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/bisakerja_api_test?sslmode=require&channel_binding=require"
      });
    }).not.toThrow();
  });

  test("rejects non-test application environments", () => {
    expect(() => {
      assertIntegrationTestEnvironment(testConfig({ APP_ENV: "local" }));
    }).toThrow("Integration tests must run with APP_ENV=test.");
  });

  test("rejects shared-looking database URLs", () => {
    expect(() => {
      assertIntegrationTestEnvironment(testConfig(), {
        databaseUrl: "postgresql://app:secret@db.internal:5432/bisakerja"
      });
    }).toThrow("Integration tests must use an isolated test DATABASE_URL.");
  });
});
