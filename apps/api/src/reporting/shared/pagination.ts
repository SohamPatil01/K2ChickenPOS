// @ts-nocheck

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function parsePagination(query: PaginationParams): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || 50));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginateArray<T>(
  items: T[],
  query: PaginationParams
): PaginatedResult<T> {
  const { page, pageSize, skip, take } = parsePagination(query);
  const slice = items.slice(skip, skip + take);
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  return {
    items: slice,
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

export function paginateMeta(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize) || 1;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
