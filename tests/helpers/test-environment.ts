import type { AppConfig } from "@/config/env";

const TEST_DATABASE_PATTERNS = [
  /test/i,
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/
];

export type TestEnvironmentGuardOptions = {
  databaseUrl?: string;
};

export function assertIntegrationTestEnvironment(
  config: AppConfig,
  options: TestEnvironmentGuardOptions = {}
) {
  if (config.app.env !== "test") {
    throw new Error("Integration tests must run with APP_ENV=test.");
  }

  if (!options.databaseUrl) {
    return;
  }

  const databaseUrl = options.databaseUrl.trim();

  if (!databaseUrl) {
    throw new Error("Integration tests require a DATABASE_URL value.");
  }

  if (!TEST_DATABASE_PATTERNS.some((pattern) => pattern.test(databaseUrl))) {
    throw new Error(
      "Integration tests must use an isolated test DATABASE_URL."
    );
  }
}
