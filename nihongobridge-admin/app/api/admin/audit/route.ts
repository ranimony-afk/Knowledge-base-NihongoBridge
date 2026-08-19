import { NextResponse } from "next/server";
import { z } from "zod";

import { adminContext, requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["create", "update", "delete"]),
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(500),
  diff: z.object({
    before: z.unknown().optional(),
    after: z.unknown().optional(),
    changed: z.array(z.string()).optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const context = adminContext();
    requirePermission(context, "edit");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    await recordAudit(
      context,
      parsed.data.action,
      parsed.data.entityType,
      parsed.data.entityId,
      parsed.data.diff,
    );
    return NextResponse.json({ data: { logged: true } }, { status: 201 });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audit failed" }, { status });
  }
}
