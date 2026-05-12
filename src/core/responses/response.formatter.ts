import type { ErrorEnvelope, ListMeta } from "@/core/responses/response.types";
export type {
  ErrorEnvelope,
  ListMeta,
  PaginationMeta
} from "@/core/responses/response.types";

export function successResponse<T>(
  data: T,
  message = "Permintaan berhasil diproses",
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
  message = "Sumber daya berhasil dibuat",
  meta: unknown = null
) {
  return successResponse(data, message, meta);
}

export function listResponse<T>(
  data: T[],
  meta: ListMeta,
  message = "Data berhasil diambil"
) {
  return successResponse(data, message, meta);
}

export function emptyResponse(message = "Permintaan berhasil diproses") {
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
