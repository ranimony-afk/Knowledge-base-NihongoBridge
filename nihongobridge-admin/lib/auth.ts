import { headers } from "next/headers";

import type { AdminRole } from "@/types/admin";

export interface AdminContext {
  userId: string;
  role: AdminRole;
  ipAddress: string | null;
  userAgent: string | null;
}

export function adminContext(): AdminContext {
  const values = headers();
  const userId = values.get("x-admin-user-id");
  const role = values.get("x-admin-role");
  if (!userId || !isRole(role)) throw new AdminAuthError("Admin authentication required", 401);
  return {
    userId,
    role,
    ipAddress: values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: values.get("user-agent"),
  };
}

export function requirePermission(
  context: AdminContext,
  permission: "read" | "edit" | "delete" | "etl" | "publish" | "review",
): void {
  if (context.role === "super_admin") return;
  if (permission === "read") return;
  if (context.role === "reviewer" && permission === "review") return;
  if (
    context.role === "content_editor" &&
    ["edit", "publish", "review"].includes(permission)
  ) {
    return;
  }
  throw new AdminAuthError("This role does not have permission for that action", 403);
}

function isRole(value: string | null): value is AdminRole {
  return value === "super_admin" || value === "content_editor" || value === "reviewer";
}

export class AdminAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}
