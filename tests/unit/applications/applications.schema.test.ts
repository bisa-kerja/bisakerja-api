import { describe, expect, test } from "bun:test";

import {
  createApplicationSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
  updateApplicationStatusSchema
} from "@/modules/applications/applications.schema";

describe("applications schemas", () => {
  test("normalizes list query defaults and validates enums", () => {
    expect(listApplicationsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      sort: "updated_desc"
    });

    const query = listApplicationsQuerySchema.parse({
      page: "2",
      limit: "10",
      keyword: " backend ",
      status: "APPLIED",
      sort: "created_desc"
    });

    expect(query).toEqual({
      page: 2,
      limit: 10,
      keyword: "backend",
      status: "APPLIED",
      sort: "created_desc"
    });
    expect(
      listApplicationsQuerySchema.safeParse({ status: "DIPROSES" }).success
    ).toBe(false);
  });

  test("defaults create payload and rejects user id injection", () => {
    const parsed = createApplicationSchema.parse({
      jobId: "11111111-1111-4111-8111-111111111111",
      notes: " Applied from detail page "
    });

    expect(parsed).toEqual({
      jobId: "11111111-1111-4111-8111-111111111111",
      status: "APPLIED",
      notes: "Applied from detail page",
      source: "MANUAL"
    });
    expect(
      createApplicationSchema.safeParse({
        jobId: "11111111-1111-4111-8111-111111111111",
        userId: "user-2"
      }).success
    ).toBe(false);
  });

  test("requires at least one metadata update field", () => {
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
    expect(updateApplicationSchema.parse({ notes: null })).toEqual({
      notes: null
    });
    expect(
      updateApplicationSchema.parse({ source: "EXTERNAL_APPLY_CLICK" })
    ).toEqual({
      source: "EXTERNAL_APPLY_CLICK"
    });
  });

  test("validates status update payload", () => {
    expect(
      updateApplicationStatusSchema.parse({
        status: "INTERVIEW",
        notes: "Recruiter replied"
      })
    ).toEqual({
      status: "INTERVIEW",
      notes: "Recruiter replied"
    });
    expect(
      updateApplicationStatusSchema.safeParse({ status: "DIPROSES" }).success
    ).toBe(false);
  });
});
