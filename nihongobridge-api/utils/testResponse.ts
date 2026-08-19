import { AuthenticationError } from "@/lib/auth";
import { SessionConflictError, SessionNotFoundError } from "@/lib/session";
import { StorageHttpError } from "@/lib/storage";
import { TestEngineError } from "@/lib/testEngine";
import { apiError } from "@/utils/response";

export function testApiError(error: unknown, headers?: HeadersInit) {
  if (error instanceof AuthenticationError) {
    return apiError(error.status, error.message, undefined, headers);
  }
  if (error instanceof TestEngineError) {
    return apiError(error.status, error.message, undefined, headers);
  }
  if (error instanceof SessionNotFoundError) {
    return apiError(404, error.message, undefined, headers);
  }
  if (error instanceof SessionConflictError) {
    return apiError(409, error.message, undefined, headers);
  }
  if (error instanceof StorageHttpError) {
    return apiError(error.status, error.message, undefined, headers);
  }
  console.error("Test API request failed", error);
  return apiError(500, "Internal test engine error", undefined, headers);
}
