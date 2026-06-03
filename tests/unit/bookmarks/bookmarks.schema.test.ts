import { describe, expect, test } from "bun:test";

import {
  bookmarkParamsSchema,
  listBookmarksQuerySchema,
  saveBookmarkSchema
} from "@/modules/bookmarks/bookmarks.schema";

describe("bookmarks schemas", () => {
  test("parses list query defaults and supported sort values", () => {
    const defaults = listBookmarksQuerySchema.parse({});
    const parsed = listBookmarksQuerySchema.parse({
      page: "2",
      limit: "10",
      keyword: " backend ",
      sort: "salary_highest"
    });

    expect(defaults).toMatchObject({
      page: 1,
      limit: 20,
      sort: "created_desc"
    });
    expect(parsed).toMatchObject({
      page: 2,
      limit: 10,
      keyword: "backend",
      sort: "salary_highest"
    });
  });

  test("rejects unknown query/body fields and invalid ids", () => {
    expect(() => listBookmarksQuerySchema.parse({ sort: "oldest" })).toThrow();
    expect(() =>
      listBookmarksQuerySchema.parse({ unknown: "value" })
    ).toThrow();
    expect(() =>
      saveBookmarkSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        userId: "user-1"
      })
    ).toThrow();
    const invalidBodyJobId = saveBookmarkSchema.safeParse({ jobId: "job_123" });
    expect(invalidBodyJobId.success).toBe(false);
    expect(invalidBodyJobId.error?.issues[0]?.message).toBe(
      "Job ID is invalid. Use a valid UUID"
    );

    const invalidParamJobId = bookmarkParamsSchema.safeParse({
      jobId: "job_123"
    });
    expect(invalidParamJobId.success).toBe(false);
    expect(invalidParamJobId.error?.issues[0]?.message).toBe(
      "Job ID is invalid. Use a valid UUID"
    );
  });
});
