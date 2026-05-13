import { z } from "zod";

import { allowedBookmarkSorts } from "@/modules/bookmarks/bookmarks.constants";

export const listBookmarksQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(allowedBookmarkSorts).default("created_desc")
});

export const saveBookmarkSchema = z.strictObject({
  jobId: z.uuid()
});

export const bookmarkParamsSchema = z.strictObject({
  jobId: z.uuid()
});

export type ListBookmarksQueryInput = z.infer<typeof listBookmarksQuerySchema>;
export type SaveBookmarkInput = z.infer<typeof saveBookmarkSchema>;
export type BookmarkParamsInput = z.infer<typeof bookmarkParamsSchema>;
