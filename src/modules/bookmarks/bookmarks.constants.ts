export const allowedBookmarkSorts = [
  "created_desc",
  "updated_desc",
  "newest",
  "salary_highest",
  "salary_lowest"
] as const;

export const bookmarksErrorCodes = {
  bookmarkAlreadyExists: "BOOKMARK_ALREADY_EXISTS",
  bookmarkNotFound: "BOOKMARK_NOT_FOUND",
  jobNotFound: "JOB_NOT_FOUND"
} as const;
