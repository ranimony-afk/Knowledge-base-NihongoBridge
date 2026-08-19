import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function toPagination(page: number, limit: number): Pagination {
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total } as const;
}
