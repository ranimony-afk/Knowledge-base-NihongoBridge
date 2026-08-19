import { NextResponse } from "next/server";
import { z } from "zod";

import { adminContext, requirePermission } from "@/lib/auth";
import { auditValues } from "@/lib/audit";
import { getAdminDb } from "@/lib/db";
import { adminAuditLogs, etlPipelineRuns } from "@/schema/admin";

const schema = z.object({
  pipeline: z.enum(["JMdict", "KANJIDIC2", "KanjiVG", "Tatoeba", "TTS", "Questions"]),
});

export async function POST(request: Request) {
  try {
    const context = adminContext();
    requirePermission(context, "etl");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const run = await getAdminDb().transaction(async (transaction) => {
      const [created] = await transaction
        .insert(etlPipelineRuns)
        .values({
          pipeline: parsed.data.pipeline,
          status: "queued",
          triggeredBy: context.userId,
          logs: [`Queued ${parsed.data.pipeline} pipeline`],
        })
        .returning();
      await transaction.insert(adminAuditLogs).values(
        auditValues(context, "create", "etl_pipeline_run", created!.id, {
          after: { pipeline: parsed.data.pipeline },
        }),
      );
      return created!;
    });

    const controller = process.env.ETL_CONTROL_URL;
    if (controller && process.env.ADMIN_DEMO_MODE !== "true") {
      void fetch(`${controller.replace(/\/$/, "")}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline: parsed.data.pipeline, run_id: run.id }),
      });
    }
    return NextResponse.json({ data: run }, { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "ETL run failed" }, { status });
  }
}
