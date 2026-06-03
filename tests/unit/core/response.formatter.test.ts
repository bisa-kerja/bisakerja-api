import { describe, expect, test } from "bun:test";

import {
  createdResponse,
  emptyResponse,
  errorResponse,
  listResponse,
  successResponse
} from "@/core/responses/response.formatter";

describe("response formatter", () => {
  test("formats a success response", () => {
    expect(successResponse({ id: "job_123" })).toEqual({
      success: true,
      message: "Request completed successfully",
      data: { id: "job_123" },
      meta: null
    });
  });

  test("formats a created response", () => {
    expect(
      createdResponse({ id: "app_123" }, "Application created successfully")
    ).toEqual({
      success: true,
      message: "Application created successfully",
      data: { id: "app_123" },
      meta: null
    });
  });

  test("formats a paginated list response", () => {
    expect(
      listResponse(
        [{ id: "job_123" }],
        {
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          },
          sort: "newest"
        },
        "Jobs retrieved successfully"
      )
    ).toEqual({
      success: true,
      message: "Jobs retrieved successfully",
      data: [{ id: "job_123" }],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        sort: "newest"
      }
    });
  });

  test("formats empty and error responses", () => {
    expect(emptyResponse("Berhasil dihapus")).toEqual({
      success: true,
      message: "Berhasil dihapus",
      data: null,
      meta: null
    });

    expect(
      errorResponse("Validation failed", "VALIDATION_ERROR", "req_123", [])
    ).toEqual({
      success: false,
      message: "Validation failed",
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        details: [],
        requestId: "req_123"
      }
    });
  });
});
