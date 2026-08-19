import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
}

const DEFAULT_META: ApiMeta = { page: 1, limit: 1, total: 0 };

export function apiSuccess<T>(
  data: T,
  meta: ApiMeta = { page: 1, limit: 1, total: 1 },
  status = 200,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ data, meta }, { status, ...(headers ? { headers } : {}) });
}

export function apiError(
  status: number,
  error: string,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    { data: details ?? {}, meta: DEFAULT_META, error },
    { status, ...(headers ? { headers } : {}) },
  );
}

export function zodErrorMessage(issues: ZodIssue[]): string {
  return issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "request"}: ${issue.message}`)
    .join("; ");
}
