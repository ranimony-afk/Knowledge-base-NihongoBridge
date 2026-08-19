import { etlPipelineRuns } from "@/schema/admin";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { adminContext, requirePermission } from "@/lib/auth";
import { getAdminDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = adminContext();
    requirePermission(context, "read");
    const url = new URL(request.url);
    const runId = z.string().uuid().safeParse(url.searchParams.get("run_id"));
    if (!runId.success) return new Response("Invalid run_id", { status: 400 });

    const encoder = new TextEncoder();
    let sent = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
      start(controller) {
        const push = async () => {
          if (request.signal.aborted) {
            if (timer) clearInterval(timer);
            controller.close();
            return;
          }
          try {
            const [run] = await getAdminDb()
              .select()
              .from(etlPipelineRuns)
              .where(eq(etlPipelineRuns.id, runId.data))
              .limit(1);
            if (!run) {
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "Run not found" })}\n\n`));
              controller.close();
              if (timer) clearInterval(timer);
              return;
            }
            for (const line of run.logs.slice(sent)) {
              controller.enqueue(encoder.encode(`event: log\ndata: ${JSON.stringify({ line })}\n\n`));
            }
            sent = run.logs.length;
            controller.enqueue(
              encoder.encode(
                `event: progress\ndata: ${JSON.stringify({
                  status: run.status,
                  records_imported: run.recordsImported,
                  errors: run.errorCount,
                })}\n\n`,
              ),
            );
            if (["completed", "failed", "cancelled"].includes(run.status)) {
              controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ status: run.status })}\n\n`));
              controller.close();
              if (timer) clearInterval(timer);
            }
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : "Stream failed" })}\n\n`,
              ),
            );
          }
        };
        void push();
        timer = setInterval(() => void push(), 1_000);
      },
      cancel() {
        if (timer) clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return new Response(error instanceof Error ? error.message : "Stream failed", { status });
  }
}
