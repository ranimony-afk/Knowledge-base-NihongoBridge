import { z } from "zod";

const toolInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
  level: z.enum(["N5", "N4", "N3", "N2", "N1"]).optional(),
  limit: z.number().int().min(1).max(5).default(5),
});

interface DictionaryApiResponse {
  data?: unknown;
  error?: string;
}

export const DICTIONARY_TOOL = {
  name: "lookup_dictionary",
  description:
    "Look up a Japanese word in NihongoBridge's dictionary. Use this to verify readings, meanings, JLPT level, and part of speech.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Japanese word, kana, romaji, or English meaning" },
      level: { type: "string", enum: ["N5", "N4", "N3", "N2", "N1"] },
      limit: { type: "integer", minimum: 1, maximum: 5 },
    },
    required: ["query"],
    additionalProperties: false,
  },
} as const;

export async function lookupDictionary(input: unknown): Promise<string> {
  const parsed = toolInputSchema.safeParse(input);
  if (!parsed.success) {
    return JSON.stringify({ error: "Invalid dictionary lookup input" });
  }

  const base = process.env.NIHONGOBRIDGE_API_URL;
  if (!base) return JSON.stringify({ error: "Dictionary service is not configured" });

  let url: URL;
  try {
    const baseUrl = new URL(base);
    if (!new Set(["http:", "https:"]).has(baseUrl.protocol)) {
      return JSON.stringify({ error: "Dictionary service URL is invalid" });
    }
    url = new URL("/api/dictionary/search", baseUrl);
  } catch {
    return JSON.stringify({ error: "Dictionary service URL is invalid" });
  }
  url.searchParams.set("q", parsed.data.query);
  url.searchParams.set("limit", String(parsed.data.limit));
  if (parsed.data.level) url.searchParams.set("level", parsed.data.level);

  const headers = new Headers({ Accept: "application/json" });
  const serviceToken = process.env.NIHONGOBRIDGE_API_SERVICE_TOKEN;
  if (serviceToken) headers.set("Authorization", `Bearer ${serviceToken}`);

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    const body = await response.json() as DictionaryApiResponse;
    if (!response.ok) {
      return JSON.stringify({ error: body.error ?? `Dictionary returned HTTP ${response.status}` });
    }
    const results = Array.isArray(body.data) ? body.data.slice(0, parsed.data.limit) : [];
    return JSON.stringify({ results });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? `Dictionary lookup failed: ${error.message}` : "Dictionary lookup failed",
    });
  }
}
