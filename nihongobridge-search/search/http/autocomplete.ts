import { z } from "zod";

import { meilisearch } from "../lib/clients.js";
import { config, INDEXES } from "../lib/config.js";
import { normalizeJapaneseQuery } from "../lib/japanese.js";
import { TtlLruCache } from "../lib/lru.js";

const schema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export interface AutocompleteItem {
  id: string;
  word: string;
  kana: string | null;
  _formatted?: { word?: string | undefined; kana?: string | undefined } | undefined;
}

export interface AutocompleteResult {
  data: AutocompleteItem[];
  processingTimeMs: number;
  cache: "HIT" | "MISS";
}

let cache: TtlLruCache<Omit<AutocompleteResult, "cache">> | undefined;

function suggestionCache() {
  const values = config();
  cache ??= new TtlLruCache(values.AUTOCOMPLETE_CACHE_MAX, values.AUTOCOMPLETE_CACHE_TTL_MS);
  return cache;
}

export async function autocomplete(input: unknown): Promise<AutocompleteResult> {
  const request = schema.parse(input);
  const normalized = normalizeJapaneseQuery(request.q);
  const key = `${normalized}:${request.limit}`;
  const cached = suggestionCache().get(key);
  if (cached) return { ...cached, cache: "HIT" };

  const started = performance.now();
  const response = await meilisearch().index(INDEXES.autocomplete).search<AutocompleteItem>(
    normalized,
    {
      limit: request.limit,
      attributesToRetrieve: ["id", "word", "kana"],
      attributesToHighlight: ["word", "kana"],
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
      matchingStrategy: "last",
    },
  );
  const value = {
    data: response.hits.map((hit) => ({
      id: String(hit.id),
      word: String(hit.word),
      kana: hit.kana ? String(hit.kana) : null,
      ...(hit._formatted ? { _formatted: hit._formatted as AutocompleteItem["_formatted"] } : {}),
    })),
    processingTimeMs: Math.round((performance.now() - started) * 100) / 100,
  };
  suggestionCache().set(key, value);
  return { ...value, cache: "MISS" };
}

export function clearAutocompleteCache(): void {
  cache?.clear();
  cache = undefined;
}
