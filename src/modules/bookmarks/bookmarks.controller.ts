import type { Request, Response } from "express";

import {
  createdResponse,
  listResponse
} from "@/core/responses/response.formatter";
import { bookmarksErrorCodes } from "@/modules/bookmarks/bookmarks.constants";
import type {
  ListBookmarksQueryInput,
  SaveBookmarkInput
} from "@/modules/bookmarks/bookmarks.schema";
import { BookmarksService } from "@/modules/bookmarks/bookmarks.service";
import type { BookmarksControllerDependencies } from "@/modules/bookmarks/bookmarks.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class BookmarksController {
  private readonly service: BookmarksService;

  constructor(private readonly dependencies: BookmarksControllerDependencies) {
    this.service = new BookmarksService(dependencies.repository, {
      staleAfterHours: dependencies.config.jobs.staleAfterHours,
      now: dependencies.now
    });
  }

  listBookmarks = async (req: Request, res: Response) => {
    const query = req.query as unknown as ListBookmarksQueryInput;
    const result = await this.service.listBookmarks(
      req.auth?.userId ?? "",
      query
    );

    emitAuditEvent({
      action: "bookmarks.list_requested",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "bookmark",
      result: "success",
      metadata: {
        keywordPresent: Boolean(query.keyword),
        filters: result.meta.filters,
        sort: result.meta.sort,
        page: result.meta.pagination.page,
        limit: result.meta.pagination.limit,
        resultCount: result.data.length
      }
    });

    res.json(
      listResponse(result.data, result.meta, "Bookmarks retrieved successfully")
    );
  };

  saveBookmark = async (req: Request, res: Response) => {
    const input = req.body as SaveBookmarkInput;
    let bookmark;

    try {
      bookmark = await this.service.saveBookmark(req.auth?.userId ?? "", input);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === bookmarksErrorCodes.bookmarkAlreadyExists
      ) {
        emitAuditEvent({
          action: "bookmarks.duplicate_rejected",
          requestId: req.requestId,
          actorId: req.auth?.userId,
          resourceType: "bookmark",
          result: "failure",
          metadata: {
            jobId: input.jobId
          }
        });
      }

      throw error;
    }

    emitAuditEvent({
      action: "bookmarks.created",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "bookmark",
      resourceId: bookmark.id,
      result: "success",
      metadata: {
        jobId: bookmark.jobId
      }
    });

    res.status(201).json(createdResponse(bookmark, "Job saved successfully"));
  };

  deleteBookmark = async (req: Request, res: Response) => {
    const params = req.params as { jobId: string };

    await this.service.deleteBookmark(req.auth?.userId ?? "", params.jobId);

    emitAuditEvent({
      action: "bookmarks.deleted",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "bookmark",
      result: "success",
      metadata: {
        jobId: params.jobId
      }
    });

    res.status(204).send();
  };
}
