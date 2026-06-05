import { z } from "zod";

import { allowedBookmarkSorts } from "@/modules/bookmarks/bookmarks.constants";

export const listBookmarksQuerySchema = z.strictObject({
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .default(20),
  keyword: z
    .string()
    .trim()
    .min(1, "Keyword cannot be empty")
    .max(120, "Keyword must be at most 120 characters")
    .optional(),
  sort: z.enum(allowedBookmarkSorts).default("created_desc")
});

export const saveBookmarkSchema = z.strictObject({
  jobId: z.uuid("Job ID is invalid. Use a valid UUID")
});

export const bookmarkParamsSchema = z.strictObject({
  jobId: z.uuid("Job ID is invalid. Use a valid UUID")
});

export type ListBookmarksQueryInput = z.infer<typeof listBookmarksQuerySchema>;
export type SaveBookmarkInput = z.infer<typeof saveBookmarkSchema>;
export type BookmarkParamsInput = z.infer<typeof bookmarkParamsSchema>;
