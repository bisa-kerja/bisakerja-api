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
    const invalidRange = listJobsQuerySchema.safeParse({
      salaryMin: "100",
      salaryMax: "50"
    });
    expect(invalidRange.success).toBe(false);
    expect(invalidRange.error?.issues[0]?.path.join(".")).toBe("salaryMax");
    expect(invalidRange.error?.issues[0]?.message).toBe(
      "Maximum salary must be greater than or equal to minimum salary"
    );

    const invalidJobId = jobParamsSchema.safeParse({ jobId: "job_123" });
    expect(invalidJobId.success).toBe(false);
    expect(invalidJobId.error?.issues[0]?.message).toBe(
      "Job ID is invalid. Use a valid UUID"
    );
  });
});
