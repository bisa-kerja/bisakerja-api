import { describe, expect, test } from "bun:test";

import { BookmarksService } from "@/modules/bookmarks";
import type {
  BookmarkListResult,
  BookmarkRecord,
  BookmarksRepository
} from "@/modules/bookmarks";
import type { ListBookmarksQueryInput } from "@/modules/bookmarks/bookmarks.schema";
import type { JobRecord } from "@/modules/jobs";

const now = new Date("2026-04-23T00:00:00.000Z");
const jobId = "11111111-1111-4111-8111-111111111111";

describe("BookmarksService", () => {
  test("returns paginated bookmark resources using job card shape", async () => {
    const repository = new StaticBookmarksRepository([
      bookmarkRecord({ userId: "user-1", job: jobRecord() })
    ]);
    const service = new BookmarksService(repository, {
      staleAfterHours: 72,
      now: () => now
    });

    const result = await service.listBookmarks("user-1", {
      page: 1,
      limit: 20,
      sort: "created_desc"
    });

    expect(result).toMatchObject({
      data: [
        {
          id: "bookmark-user-1",
          job: {
            id: jobId,
            sourcePlatform: { slug: "glints" },
            employmentType: "FULL_TIME",
            isStale: false
          },
          createdAt: "2026-04-22T00:00:00.000Z"
        }
      ],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        filters: {},
        sort: "created_desc"
      }
    });
  });

  test("saves an existing visible job and rejects missing or duplicate saves", async () => {
    const repository = new StaticBookmarksRepository([], [jobRecord()]);
    const service = new BookmarksService(repository, {
      staleAfterHours: 72,
      now: () => now
    });

    const saved = await service.saveBookmark("user-1", { jobId });
    expect(saved).toMatchObject({ jobId });

    expect.assertions(3);

    try {
      await service.saveBookmark("user-1", { jobId });
    } catch (error) {
      expect(error).toHaveProperty("code", "BOOKMARK_ALREADY_EXISTS");
    }

    try {
      await service.saveBookmark("user-1", {
        jobId: "99999999-9999-4999-8999-999999999999"
      });
    } catch (error) {
      expect(error).toHaveProperty("code", "JOB_NOT_FOUND");
    }
  });

  test("deletes only existing current-user bookmarks", async () => {
    const repository = new StaticBookmarksRepository([
      bookmarkRecord({ userId: "user-1", job: jobRecord() })
    ]);
    const service = new BookmarksService(repository, {
      staleAfterHours: 72,
      now: () => now
    });

    await service.deleteBookmark("user-1", jobId);

    expect.assertions(1);

    try {
      await service.deleteBookmark("user-2", jobId);
    } catch (error) {
      expect(error).toHaveProperty("code", "BOOKMARK_NOT_FOUND");
    }
  });
});

class StaticBookmarksRepository implements BookmarksRepository {
  private readonly bookmarks = new Map<string, BookmarkRecord>();

  constructor(
    bookmarks: BookmarkRecord[],
    private readonly jobs: JobRecord[] = bookmarks.map(
      (bookmark) => bookmark.job
    )
  ) {
    for (const bookmark of bookmarks) {
      this.bookmarks.set(key(bookmark.userId, bookmark.jobListingId), bookmark);
    }
  }

  listForUser(
    userId: string,
    _query: ListBookmarksQueryInput
  ): Promise<BookmarkListResult> {
    const items = [...this.bookmarks.values()].filter(
      (bookmark) => bookmark.userId === userId
    );
    return Promise.resolve({ items, total: items.length });
  }

  findVisibleJobById(id: string): Promise<JobRecord | null> {
    return Promise.resolve(this.jobs.find((job) => job.id === id) ?? null);
  }

  findByUserAndJob(userId: string, id: string): Promise<BookmarkRecord | null> {
    return Promise.resolve(this.bookmarks.get(key(userId, id)) ?? null);
  }

  createForUser(userId: string, id: string): Promise<BookmarkRecord> {
    const job = this.jobs.find((item) => item.id === id);

    if (!job) {
      throw new Error("Job fixture missing");
    }

    const bookmark = bookmarkRecord({ userId, job });
    this.bookmarks.set(key(userId, id), bookmark);
    return Promise.resolve(bookmark);
  }

  deleteByUserAndJob(userId: string, id: string): Promise<boolean> {
    return Promise.resolve(this.bookmarks.delete(key(userId, id)));
  }
}

function key(userId: string, id: string) {
  return `${userId}:${id}`;
}

function bookmarkRecord(input: {
  userId: string;
  job: JobRecord;
}): BookmarkRecord {
  return {
    id: `bookmark-${input.userId}`,
    userId: input.userId,
    jobListingId: input.job.id,
    createdAt: new Date("2026-04-22T00:00:00.000Z"),
    job: input.job
  };
}

function jobRecord(): JobRecord {
  return {
    id: jobId,
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description: "Build APIs.",
    requirementSummary: "TypeScript",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: { display: "Jakarta", province: "DKI Jakarta", city: "Jakarta" },
    salary: {
      min: 5_000_000,
      max: 10_000_000,
      currency: "IDR",
      period: "MONTHLY",
      display: null
    },
    sourceUrl: "https://example.test/job",
    externalApplyUrl: "https://example.test/apply",
    postedAt: new Date("2026-04-20T00:00:00.000Z"),
    sourceUpdatedAt: null,
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-22T00:00:00.000Z"),
    company: { id: "company-1", name: "Nusantara Tech", logoUrl: null },
    sourcePlatform: { id: "source-1", name: "Glints", slug: "glints" },
    requirements: [],
    skills: []
  };
}
