import { describe, expect, test } from "bun:test";

import {
  hasSalaryOverlap,
  isJobStale,
  serializeJobCard,
  serializeJobDetail
} from "@/modules/jobs/jobs.mapper";
import type { JobRecord } from "@/modules/jobs/jobs.types";

const now = new Date("2026-04-23T00:00:00.000Z");

describe("jobs mapper", () => {
  test("computes stale flag from lastSeenAt and configured threshold", () => {
    expect(isJobStale(new Date("2026-04-22T00:00:00.000Z"), 72, now)).toBe(
      false
    );
    expect(isJobStale(new Date("2026-04-19T23:59:59.000Z"), 72, now)).toBe(
      true
    );
  });

  test("maps card and detail without raw source fields", () => {
    const card = serializeJobCard(jobRecord(), 72, now);
    const detail = serializeJobDetail(jobRecord(), 72, now);

    expect(card).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Backend Developer",
      company: { name: "Nusantara Tech" },
      sourcePlatform: { slug: "glints" },
      salary: { min: 5_000_000, max: 10_000_000 },
      isStale: false
    });
    expect(detail).toMatchObject({
      description: "Build APIs.",
      requirements: [{ type: "SKILL", value: "TypeScript", priority: "HIGH" }],
      skills: ["TypeScript"],
      externalApplyUrl: "https://glints.example/apply"
    });
    expect(JSON.stringify(detail)).not.toContain("externalJobId");
  });

  test("checks salary range overlap", () => {
    expect(hasSalaryOverlap(5_000_000, 10_000_000, 8_000_000, undefined)).toBe(
      true
    );
    expect(hasSalaryOverlap(5_000_000, 10_000_000, undefined, 4_000_000)).toBe(
      false
    );
    expect(hasSalaryOverlap(null, null, 1, 2)).toBe(false);
  });
});

function jobRecord(): JobRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description: "Build APIs.",
    requirementSummary: "TypeScript",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: {
      display: "Jakarta Selatan, DKI Jakarta",
      province: "DKI Jakarta",
      city: "Jakarta Selatan"
    },
    salary: {
      min: 5_000_000,
      max: 10_000_000,
      currency: "IDR",
      period: "MONTHLY",
      display: "Rp5.000.000 - Rp10.000.000 / bulan"
    },
    sourceUrl: "https://glints.example/job",
    externalApplyUrl: "https://glints.example/apply",
    postedAt: new Date("2026-04-20T00:00:00.000Z"),
    sourceUpdatedAt: null,
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-22T00:00:00.000Z"),
    company: {
      id: "company-1",
      name: "Nusantara Tech",
      logoUrl: null,
      websiteUrl: "https://example.test"
    },
    sourcePlatform: {
      id: "source-1",
      name: "Glints",
      slug: "glints"
    },
    requirements: [
      { type: "SKILL", value: "TypeScript", priority: "HIGH", sortOrder: 0 }
    ],
    skills: [{ name: "TypeScript" }]
  };
}
