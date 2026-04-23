import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { jobFixtures, sourcePlatformFixtures } from "../../fixtures/jobs";
import { modelApiFixtures } from "../../fixtures/model-api";
import { normalizedScraperJobFixtures } from "../../fixtures/scraper-api";
import { userFixtures } from "../../fixtures/users";

const userFixtureSchema = z.strictObject({
  id: z.string().min(1),
  email: z.email(),
  emailVerifiedAt: z.iso.datetime(),
  name: z.string().min(1),
  role: z.literal("USER")
});

const sourcePlatformFixtureSchema = z.strictObject({
  id: z.string().min(1),
  slug: z.enum(["glints", "jobstreet", "kalibrr", "dealls"]),
  name: z.string().min(1)
});

const jobFixtureSchema = z.strictObject({
  id: z.string().min(1),
  sourcePlatformId: z.string().min(1),
  externalJobId: z.string().min(1),
  companyName: z.string().min(1),
  title: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  workType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  employmentType: z.enum(["FULL_TIME", "CONTRACT", "INTERNSHIP"]),
  sourceUrl: z.url(),
  discoveredAt: z.iso.datetime(),
  skills: z.array(z.string().min(1)).min(1)
});

const modelResponseSchema = z.strictObject({
  fitScore: z.number().min(0).max(100),
  readiness: z.enum(["READY", "NEEDS_PREPARATION", "NOT_READY"]),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  recommendations: z.array(z.string()),
  model: z.strictObject({
    name: z.string().min(1),
    version: z.string().min(1)
  })
});

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
      Object.values(modelApiFixtures).map((response) =>
        modelResponseSchema.parse(response)
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
