import "dotenv/config";

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  MEILISEARCH_URL: z.string().url().default("http://localhost:7700"),
  MEILI_MASTER_KEY: z.string().min(8),
  SEARCH_BATCH_SIZE: z.coerce.number().int().min(100).max(5_000).default(1_000),
  SEARCH_STATE_PATH: z.string().default("./state/last-sync.json"),
  SEARCH_LOCK_PATH: z.string().default("./state/sync.lock"),
  SEARCH_NOTIFY_CHANNEL: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).default("nihongobridge_content_changes"),
  AUTOCOMPLETE_HOST: z.string().default("0.0.0.0"),
  AUTOCOMPLETE_PORT: z.coerce.number().int().min(1).max(65_535).default(7_701),
  AUTOCOMPLETE_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  AUTOCOMPLETE_CACHE_TTL_MS: z.coerce.number().int().min(1_000).default(300_000),
  AUTOCOMPLETE_CACHE_MAX: z.coerce.number().int().min(100).max(50_000).default(2_000),
});

export type SearchConfig = z.infer<typeof schema>;
let cached: SearchConfig | undefined;

export function config(): SearchConfig {
  cached ??= schema.parse(process.env);
  return cached;
}

export const INDEXES = {
  dictionary: "dictionary",
  kanji: "kanji",
  grammar: "grammar",
  sentences: "sentences",
  autocomplete: "autocomplete",
} as const;

export type CanonicalIndex = keyof typeof INDEXES;

export function resetConfig(): void {
  cached = undefined;
}
