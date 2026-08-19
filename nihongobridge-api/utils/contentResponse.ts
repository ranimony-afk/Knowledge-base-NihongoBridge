import { AuthenticationError } from "@/lib/auth";
import { SrsError } from "@/lib/srs";
import { UserApiError } from "@/lib/user";
import { apiError } from "@/utils/response";

export function contentApiError(error: unknown, headers?: HeadersInit) {
  if (error instanceof AuthenticationError) {
    return apiError(error.status, error.message, undefined, headers);
  }
  if (error instanceof SrsError || error instanceof UserApiError) {
    return apiError(error.status, error.message, undefined, headers);
  }
  console.error("Content API request failed", error);
  return apiError(500, "Internal content service error", undefined, headers);
}
