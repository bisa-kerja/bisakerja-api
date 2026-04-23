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
          "postgresql://postgres:postgres@localhost:5432/bisakerja_api_test"
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
