import { describe, expect, test } from "bun:test";

import { jobFixtures, sourcePlatformFixtures } from "../../fixtures/jobs";
import { normalizedScraperJobFixtures } from "../../fixtures/scraper-api";

describe("fixture contracts", () => {
  test("scraper fixtures expose one normalized record per job fixture", () => {
    const jobExternalIds = jobFixtures.map((job) => job.externalJobId).sort();
    const scraperExternalIds = normalizedScraperJobFixtures
      .map((job) => job.externalJobId)
      .sort();

    expect(scraperExternalIds).toEqual(jobExternalIds);
  });

  test("normalized scraper fixtures only use supported source slugs", () => {
    const supportedSlugs = new Set(
      sourcePlatformFixtures.map((sourcePlatform) => sourcePlatform.slug)
    );

    expect(
      normalizedScraperJobFixtures.every((job) =>
        supportedSlugs.has(job.sourcePlatform.slug)
      )
    ).toBe(true);
  });
});
