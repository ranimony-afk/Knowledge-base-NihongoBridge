import { NextResponse } from "next/server";

import type { ApiMeta, ApiResponse } from "@/types/api";

export function apiSuccess<T>(
  data: T,
  meta: ApiMeta,
  init?: ResponseInit,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, meta }, init);
}

export function apiError(
  status: number,
  error: string,
  meta: ApiMeta = { page: 1, limit: 0, total: 0 },
  headers?: HeadersInit,
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { data: null, meta, error },
    { status, ...(headers ? { headers } : {}) },
  );
}

export function zodErrorMessage(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "request"}: ${issue.message}`)
    .join("; ");
}
