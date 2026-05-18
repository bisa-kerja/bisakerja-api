import { z } from "zod";

import { allowedBookmarkSorts } from "@/modules/bookmarks/bookmarks.constants";

export const listBookmarksQuerySchema = z.strictObject({
  page: z.coerce
    .number()
    .int("Halaman harus berupa bilangan bulat")
    .min(1, "Halaman minimal 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Batas data harus berupa bilangan bulat")
    .min(1, "Batas data minimal 1")
    .max(100, "Batas data maksimal 100")
    .default(20),
  keyword: z
    .string()
    .trim()
    .min(1, "Kata kunci tidak boleh kosong")
    .max(120, "Kata kunci maksimal 120 karakter")
    .optional(),
  sort: z.enum(allowedBookmarkSorts).default("created_desc")
});

export const saveBookmarkSchema = z.strictObject({
  jobId: z.uuid("ID lowongan tidak valid. Gunakan UUID yang benar")
});

export const bookmarkParamsSchema = z.strictObject({
  jobId: z.uuid("ID lowongan tidak valid. Gunakan UUID yang benar")
});

export type ListBookmarksQueryInput = z.infer<typeof listBookmarksQuerySchema>;
export type SaveBookmarkInput = z.infer<typeof saveBookmarkSchema>;
export type BookmarkParamsInput = z.infer<typeof bookmarkParamsSchema>;
