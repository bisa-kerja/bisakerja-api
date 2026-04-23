export { createBookmarksRouter } from "@/modules/bookmarks/bookmarks.route";
export { BookmarksController } from "@/modules/bookmarks/bookmarks.controller";
export { BookmarksService } from "@/modules/bookmarks/bookmarks.service";
export { PrismaBookmarksRepository } from "@/modules/bookmarks/bookmarks.repository";
export type {
  BookmarkListResult,
  BookmarkRecord,
  BookmarkResource,
  BookmarkSummary,
  BookmarksRepository,
  BookmarksRouterOptions
} from "@/modules/bookmarks/bookmarks.types";
