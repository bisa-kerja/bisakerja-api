export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ListMeta = {
  pagination: PaginationMeta;
  filters?: Record<string, unknown>;
  sort?: string;
  [key: string]: unknown;
};

export type ErrorEnvelope = {
  success: false;
  message: string;
  data: null;
  error: {
    code: string;
    details: unknown;
    requestId: string;
  };
};
