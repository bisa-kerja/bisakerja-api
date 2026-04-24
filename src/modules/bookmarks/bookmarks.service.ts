import { ConflictError, NotFoundError } from "@/core/errors/app.error";
import { bookmarksErrorCodes } from "@/modules/bookmarks/bookmarks.constants";
import type {
  ListBookmarksQueryInput,
  SaveBookmarkInput
} from "@/modules/bookmarks/bookmarks.schema";
import type {
  BookmarkRecord,
  BookmarksRepository,
  BookmarksServiceOptions
} from "@/modules/bookmarks/bookmarks.types";
import { serializeProvidedFilters } from "@/shared/utils/filters";
import { serializeJobCard } from "@/shared/utils/job-presentation";

export class BookmarksService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: BookmarksRepository,
    private readonly options: BookmarksServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async listBookmarks(userId: string, query: ListBookmarksQueryInput) {
    const result = await this.repository.listForUser(userId, query);
    const totalPages = Math.ceil(result.total / query.limit);
    const now = this.now();

    return {
      data: result.items.map((bookmark) =>
        serializeBookmarkResource(bookmark, this.options.staleAfterHours, now)
      ),
      meta: {
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPrevPage: query.page > 1
        },
        filters: serializeProvidedFilters({
          keyword: query.keyword
        }),
        sort: query.sort
      }
    };
  }

  async saveBookmark(userId: string, input: SaveBookmarkInput) {
    const job = await this.repository.findVisibleJobById(input.jobId);

    if (!job) {
      throw new NotFoundError("Job not found", bookmarksErrorCodes.jobNotFound);
    }

    const existing = await this.repository.findByUserAndJob(
      userId,
      input.jobId
    );

    if (existing) {
      throw new ConflictError(
        "Bookmark already exists",
        bookmarksErrorCodes.bookmarkAlreadyExists
      );
    }

    const bookmark = await this.repository.createForUser(userId, input.jobId);

    return {
      id: bookmark.id,
      jobId: bookmark.jobListingId,
      createdAt: bookmark.createdAt.toISOString()
    };
  }

  async deleteBookmark(userId: string, jobId: string): Promise<void> {
    const deleted = await this.repository.deleteByUserAndJob(userId, jobId);

    if (!deleted) {
      throw new NotFoundError(
        "Bookmark not found",
        bookmarksErrorCodes.bookmarkNotFound
      );
    }
  }
}

export function serializeBookmarkResource(
  bookmark: BookmarkRecord,
  staleAfterHours: number,
  now: Date
) {
  return {
    id: bookmark.id,
    job: serializeJobCard(bookmark.job, staleAfterHours, now),
    createdAt: bookmark.createdAt.toISOString()
  };
}
