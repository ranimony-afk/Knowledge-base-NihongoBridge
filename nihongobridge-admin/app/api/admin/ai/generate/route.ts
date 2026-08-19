import { NextResponse } from "next/server";
import { z } from "zod";

import { adminContext, requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const requestSchema = z.object({
  kind: z.enum(["dictionary", "questions"]),
  topic: z.string().trim().min(2).max(200),
  count: z.number().int().min(1).max(50),
  level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  section: z.enum(["vocabulary", "grammar", "reading", "listening"]).optional(),
});

export async function POST(request: Request) {
  try {
    const context = adminContext();
    requirePermission(context, "edit");
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const data = await generate(parsed.data);
    await recordAudit(context, "create", `ai_${parsed.data.kind}_batch`, crypto.randomUUID(), {
      after: { request: parsed.data, generatedCount: Array.isArray(data) ? data.length : 0 },
    });
    return NextResponse.json({ data });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI generation failed" }, { status });
  }
}

async function generate(input: z.infer<typeof requestSchema>): Promise<unknown> {
  const endpoint = process.env.AI_GENERATION_URL;
  if (endpoint) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}`);
    return response.json();
  }

  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!key || !model) {
    // Safe deterministic development fallback; production must configure an AI endpoint/model.
    return Array.from({ length: input.count }, (_, index) => ({
      id: crypto.randomUUID(),
      topic: input.topic,
      level: input.level,
      section: input.section,
      draft: true,
      label: `${input.topic} draft ${index + 1}`,
    }));
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4_096,
      system:
        "Generate original NihongoBridge draft content only. Never reproduce official JLPT questions. Return strict JSON with no markdown.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic returned HTTP ${response.status}`);
  const body = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = body.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text content");
  return JSON.parse(text);
}
