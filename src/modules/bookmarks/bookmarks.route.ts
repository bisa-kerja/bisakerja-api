import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { BookmarksController } from "@/modules/bookmarks/bookmarks.controller";
import { PrismaBookmarksRepository } from "@/modules/bookmarks/bookmarks.repository";
import {
  bookmarkParamsSchema,
  listBookmarksQuerySchema,
  saveBookmarkSchema
} from "@/modules/bookmarks/bookmarks.schema";
import type { BookmarksRouterOptions } from "@/modules/bookmarks/bookmarks.types";

export function createBookmarksRouter(
  config: AppConfig,
  options: BookmarksRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaBookmarksRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const controller = new BookmarksController({
    repository,
    config,
    now: options.now
  });

  router.use(authMiddleware);

  router.get(
    "/",
    validate({ query: listBookmarksQuerySchema }),
    controller.listBookmarks
  );
  router.post(
    "/",
    validate({ body: saveBookmarkSchema }),
    controller.saveBookmark
  );
  router.delete(
    "/:jobId",
    validate({ params: bookmarkParamsSchema }),
    controller.deleteBookmark
  );

  return router;
}
