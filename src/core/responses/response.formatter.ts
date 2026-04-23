import type { ErrorEnvelope, ListMeta } from "@/core/responses/response.types";
export type {
  ErrorEnvelope,
  ListMeta,
  PaginationMeta
} from "@/core/responses/response.types";

export function successResponse<T>(
  data: T,
  message = "Request completed successfully",
  meta: unknown = null
) {
  return {
    success: true,
    message,
    data,
    meta
  };
}

export function createdResponse<T>(
  data: T,
  message = "Resource created successfully",
  meta: unknown = null
) {
  return successResponse(data, message, meta);
}

export function listResponse<T>(
  data: T[],
  meta: ListMeta,
  message = "Resources retrieved successfully"
) {
  return successResponse(data, message, meta);
}

export function emptyResponse(message = "Request completed successfully") {
  return successResponse(null, message, null);
}

export function errorResponse(
  message: string,
  code: string,
  requestId: string,
  details: unknown = null
): ErrorEnvelope {
  return {
    success: false,
    message,
    data: null,
    error: {
      code,
      details,
      requestId
    }
  };
}
