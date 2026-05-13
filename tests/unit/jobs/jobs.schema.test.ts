import { describe, expect, test } from "bun:test";

import {
  jobParamsSchema,
  listJobsQuerySchema
} from "@/modules/jobs/jobs.schema";

describe("jobs schemas", () => {
  test("parses pagination, filters, and sort query values", () => {
    const parsed = listJobsQuerySchema.parse({
      page: "2",
      limit: "10",
      keyword: " backend ",
      province: "DKI Jakarta",
      workType: "REMOTE",
      employmentType: "FULL_TIME",
      experienceLevel: "ENTRY_LEVEL",
      salaryMin: "5000000",
      salaryMax: "10000000",
      sourcePlatform: "Glints",
      skill: "TypeScript",
      category: "Engineering",
      sort: "salary_highest"
    });

    expect(parsed).toMatchObject({
      page: 2,
      limit: 10,
      keyword: "backend",
      salaryMin: 5_000_000,
      salaryMax: 10_000_000,
      sourcePlatform: "glints",
      sort: "salary_highest"
    });
  });

  test("defaults page, limit, and sort", () => {
    const parsed = listJobsQuerySchema.parse({});

    expect(parsed).toMatchObject({
      page: 1,
      limit: 20,
      sort: "relevance"
    });
  });

  test("rejects unsupported params, enum values, salary ranges, and ids", () => {
    expect(() => listJobsQuerySchema.parse({ unknown: "value" })).toThrow();
    expect(() => listJobsQuerySchema.parse({ workType: "WFH" })).toThrow();
    expect(() =>
      listJobsQuerySchema.parse({ salaryMin: "100", salaryMax: "50" })
    ).toThrow();
    expect(() => jobParamsSchema.parse({ jobId: "job_123" })).toThrow();
  });
});
