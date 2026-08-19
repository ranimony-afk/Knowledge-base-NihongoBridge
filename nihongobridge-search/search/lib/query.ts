import type {
  MultiSearchQuery,
  SearchResponse,
} from "meilisearch";
import { z } from "zod";

import { meilisearch } from "./clients.js";
import { INDEXES } from "./config.js";
import { normalizeJapaneseQuery } from "./japanese.js";

const typeSchema = z.enum(["dictionary", "kanji", "grammar", "sentences"]);
const querySchema = z
  .object({
    q: z.string().trim().min(1).max(200),
    types: z
      .string()
      .default("dictionary,kanji,grammar,sentences")
      .transform((value, context) => {
        const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
        const parsed = z.array(typeSchema).min(1).safeParse(values);
        if (!parsed.success) {
          context.addIssue({ code: "custom", message: "Unsupported search index in types" });
          return z.NEVER;
        }
        return parsed.data;
      }),
    level: z.enum(["N5", "N4", "N3", "N2", "N1", "NONE"]).optional(),
    pos: z.string().trim().min(1).max(80).optional(),
    tags: z.string().transform(csv).optional(),
    has_audio: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    grade: z.coerce.number().int().min(1).max(9).optional(),
    stroke_min: z.coerce.number().int().min(1).max(64).optional(),
    stroke_max: z.coerce.number().int().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .refine(
    (value) =>
      value.stroke_min === undefined ||
      value.stroke_max === undefined ||
      value.stroke_min <= value.stroke_max,
    { path: ["stroke_min"], message: "stroke_min cannot exceed stroke_max" },
  );

export type SearchRequest = z.output<typeof querySchema>;
export type SearchIndexName = z.infer<typeof typeSchema>;

export interface MultiIndexSearchResult {
  query: string;
  processingTimeMs: number;
  results: Partial<Record<SearchIndexName, SearchResponse<Record<string, unknown>>>>;
}

export function parseSearchParams(parameters: URLSearchParams): SearchRequest {
  return querySchema.parse(Object.fromEntries(parameters.entries()));
}

export function buildMultiSearchQueries(request: SearchRequest): MultiSearchQuery[] {
  const query = normalizeJapaneseQuery(request.q);
  return request.types.map((type) => ({
    indexUid: INDEXES[type],
    q: query,
    limit: request.limit,
    offset: request.offset,
    filter: filtersFor(type, request),
    facets: facetsFor(type),
    attributesToHighlight: ["*"],
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
    showRankingScore: true,
  }));
}

export async function multiIndexSearch(
  input: URLSearchParams | SearchRequest,
): Promise<MultiIndexSearchResult> {
  const request = input instanceof URLSearchParams ? parseSearchParams(input) : input;
  const started = performance.now();
  const response = await meilisearch().multiSearch<
    { queries: MultiSearchQuery[] },
    Record<string, unknown>
  >({
    queries: buildMultiSearchQueries(request),
  });
  const results: MultiIndexSearchResult["results"] = {};
  response.results.forEach((result, index) => {
    const type = request.types[index];
    if (type) results[type] = result;
  });
  return {
    query: normalizeJapaneseQuery(request.q),
    processingTimeMs: Math.round((performance.now() - started) * 100) / 100,
    results,
  };
}

function filtersFor(type: SearchIndexName, request: SearchRequest): string[] {
  const filters: string[] = [];
  if (request.level) filters.push(`jlpt_level = ${JSON.stringify(request.level)}`);
  if (type === "dictionary") {
    if (request.pos) filters.push(`part_of_speech = ${JSON.stringify(request.pos)}`);
    for (const tag of request.tags ?? []) filters.push(`tags = ${JSON.stringify(tag)}`);
    if (request.has_audio !== undefined) {
      filters.push(`has_audio = ${request.has_audio ? "true" : "false"}`);
    }
  }
  if (type === "kanji") {
    if (request.grade !== undefined) filters.push(`grade = ${request.grade}`);
    if (request.stroke_min !== undefined) filters.push(`stroke_count >= ${request.stroke_min}`);
    if (request.stroke_max !== undefined) filters.push(`stroke_count <= ${request.stroke_max}`);
  }
  return filters;
}

function facetsFor(type: SearchIndexName): string[] {
  if (type === "dictionary") return ["jlpt_level", "part_of_speech", "tags", "has_audio"];
  if (type === "kanji") return ["jlpt_level", "grade", "stroke_count"];
  return ["jlpt_level"];
}

function csv(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}
