import { adminAuditLogs, type AuditDiff } from "@/schema/admin";
import { getAdminDb } from "@/lib/db";
import type { AdminContext } from "@/lib/auth";

export function auditValues(
  context: AdminContext,
  action: "create" | "update" | "delete",
  entityType: string,
  entityId: string,
  diff: AuditDiff,
) {
  return {
    actorId: context.userId,
    actorRole: context.role,
    action,
    entityType,
    entityId,
    diff,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  } as const;
}

export async function recordAudit(
  context: AdminContext,
  action: "create" | "update" | "delete",
  entityType: string,
  entityId: string,
  diff: AuditDiff,
): Promise<void> {
  await getAdminDb()
    .insert(adminAuditLogs)
    .values(auditValues(context, action, entityType, entityId, diff));
}

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}
