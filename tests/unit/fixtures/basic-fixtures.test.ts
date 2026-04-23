import { describe, expect, test } from "bun:test";

import { jobFixtures, sourcePlatformFixtures } from "../../fixtures/jobs";
import { modelApiFixtures } from "../../fixtures/model-api";
import { normalizedScraperJobFixtures } from "../../fixtures/scraper-api";
import {
  cvAnalyzerModelResponseSchema,
  jobFixtureSchema,
  jobFitModelResponseSchema,
  sourcePlatformFixtureSchema,
  userFixtureSchema
} from "../../fixtures/schemas";
import { userFixtures } from "../../fixtures/users";

describe("basic fixtures", () => {
  test("defines safe synthetic users", () => {
    const users = Object.values(userFixtures);

    expect(users).toHaveLength(3);
    expect(() =>
      users.map((user) => userFixtureSchema.parse(user))
    ).not.toThrow();
  });

  test("covers all supported source platform slugs", () => {
    expect(() =>
      sourcePlatformFixtures.map((sourcePlatform) =>
        sourcePlatformFixtureSchema.parse(sourcePlatform)
      )
    ).not.toThrow();

    expect(
      sourcePlatformFixtures.map((sourcePlatform) => sourcePlatform.slug)
    ).toEqual(["glints", "jobstreet", "kalibrr", "dealls"]);
  });

  test("defines normalized job fixtures with known source platforms", () => {
    const sourcePlatformIds = new Set(
      sourcePlatformFixtures.map((sourcePlatform) => sourcePlatform.id)
    );

    expect(() =>
      jobFixtures.map((job) => jobFixtureSchema.parse(job))
    ).not.toThrow();
    expect(
      jobFixtures.every((job) => sourcePlatformIds.has(job.sourcePlatformId))
    ).toBe(true);
  });

  test("defines model responses within supported score range", () => {
    expect(() =>
      jobFitModelResponseSchema.parse(modelApiFixtures.validJobFitResponse)
    ).not.toThrow();
    expect(() =>
      jobFitModelResponseSchema.parse(modelApiFixtures.degradedJobFitResponse)
    ).not.toThrow();
    expect(() =>
      cvAnalyzerModelResponseSchema.parse(
        modelApiFixtures.validCvAnalyzerResponse
      )
    ).not.toThrow();
  });

  test("defines scraper fixtures without raw provider payloads", () => {
    expect(normalizedScraperJobFixtures).toHaveLength(jobFixtures.length);

    const fixtureText = JSON.stringify({
      userFixtures,
      sourcePlatformFixtures,
      jobFixtures,
      modelApiFixtures,
      normalizedScraperJobFixtures
    });

    expect(fixtureText).not.toMatch(
      /password|token|otp|rawPayload|rawCv|cvContent|authorization/i
    );
  });
});
