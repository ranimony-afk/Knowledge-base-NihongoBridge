import { dictionaryEntries } from "@nihongobridge/knowledge";
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { Meilisearch } from "meilisearch";

import { getDatabase } from "@/lib/db";
import { dictionaryDto } from "@/lib/serializers";
import type { DictionaryEntryDto, SearchPage } from "@/types/api";

export interface DictionarySearchParameters {
  q: string;
  level?: "N5" | "N4" | "N3" | "N2" | "N1" | undefined;
  pos?: string | undefined;
  has_audio?: boolean | undefined;
  page: number;
  limit: number;
}

let meilisearch: Meilisearch | null | undefined;

function getMeilisearch(): Meilisearch | null {
  if (meilisearch !== undefined) return meilisearch;
  const host = process.env.MEILISEARCH_URL;
  const apiKey = process.env.MEILISEARCH_KEY;
  meilisearch = host
    ? new Meilisearch({ host, ...(apiKey ? { apiKey } : {}) })
    : null;
  return meilisearch;
}

function searchVector() {
  return sql`(
    setweight(to_tsvector('simple', coalesce(${dictionaryEntries.word}, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(${dictionaryEntries.kana}, '') || ' ' || coalesce(${dictionaryEntries.romaji}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${dictionaryEntries.meanings}::text, '')), 'C')
  )`;
}

export async function searchDictionary(
  parameters: DictionarySearchParameters,
): Promise<SearchPage<DictionaryEntryDto>> {
  const meili = getMeilisearch();
  if (meili) {
    try {
      return await searchDictionaryWithMeili(meili, parameters);
    } catch (error) {
      console.warn(
        "Meilisearch dictionary query failed; using PostgreSQL fallback:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  return searchDictionaryWithPostgres(parameters);
}

async function searchDictionaryWithMeili(
  client: Meilisearch,
  parameters: DictionarySearchParameters,
): Promise<SearchPage<DictionaryEntryDto>> {
  const filters: string[] = [];
  if (parameters.level) filters.push(`jlpt_level = ${JSON.stringify(parameters.level)}`);
  if (parameters.pos) {
    filters.push(`part_of_speech = ${JSON.stringify(parameters.pos)}`);
  }
  if (parameters.has_audio !== undefined) {
    filters.push(`has_audio = ${parameters.has_audio ? "true" : "false"}`);
  }
  const indexName = process.env.MEILISEARCH_DICTIONARY_INDEX ?? "dictionary";
  const result = await client.index(indexName).search<{ id: string }>(parameters.q, {
    ...(filters.length ? { filter: filters } : {}),
    limit: parameters.limit,
    offset: (parameters.page - 1) * parameters.limit,
    attributesToRetrieve: ["id"],
    showRankingScore: true,
  });
  const ids = result.hits.map((hit) => hit.id);
  if (!ids.length) {
    return {
      items: [],
      total: result.estimatedTotalHits ?? 0,
      engine: "meilisearch",
    };
  }
  const rows = await getDatabase()
    .select()
    .from(dictionaryEntries)
    .where(and(inArray(dictionaryEntries.id, ids), eq(dictionaryEntries.isActive, true)));
  const order = new Map(ids.map((id, index) => [id, index]));
  rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  return {
    items: rows.map(dictionaryDto),
    total: result.estimatedTotalHits ?? rows.length,
    engine: "meilisearch",
  };
}

export async function searchDictionaryWithPostgres(
  parameters: DictionarySearchParameters,
): Promise<SearchPage<DictionaryEntryDto>> {
  const vector = searchVector();
  const simpleQuery = sql`plainto_tsquery('simple', ${parameters.q})`;
  const englishQuery = sql`plainto_tsquery('english', ${parameters.q})`;
  const match = sql`(
    ${vector} @@ ${simpleQuery}
    OR ${vector} @@ ${englishQuery}
    OR strpos(${dictionaryEntries.word}, ${parameters.q}) > 0
    OR strpos(coalesce(${dictionaryEntries.kana}, ''), ${parameters.q}) > 0
    OR strpos(lower(coalesce(${dictionaryEntries.romaji}, '')), lower(${parameters.q})) > 0
    OR strpos(lower(${dictionaryEntries.meanings}::text), lower(${parameters.q})) > 0
  )`;
  const filters = [eq(dictionaryEntries.isActive, true), match];
  if (parameters.level) filters.push(eq(dictionaryEntries.jlptLevel, parameters.level));
  if (parameters.pos) filters.push(arrayContains(dictionaryEntries.partOfSpeech, [parameters.pos]));
  if (parameters.has_audio !== undefined) {
    filters.push(
      parameters.has_audio
        ? isNotNull(dictionaryEntries.audioUrl)
        : isNull(dictionaryEntries.audioUrl),
    );
  }
  const where = and(...filters);
  const rank = sql<number>`greatest(
    ts_rank_cd(${vector}, ${simpleQuery}),
    ts_rank_cd(${vector}, ${englishQuery}),
    similarity(${dictionaryEntries.word}, ${parameters.q}),
    similarity(coalesce(${dictionaryEntries.kana}, ''), ${parameters.q}),
    similarity(coalesce(${dictionaryEntries.romaji}, ''), ${parameters.q})
  )`;
  const db = getDatabase();
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(dictionaryEntries)
      .where(where)
      .orderBy(desc(rank), asc(dictionaryEntries.frequencyRank), asc(dictionaryEntries.word))
      .limit(parameters.limit)
      .offset((parameters.page - 1) * parameters.limit),
    db.select({ value: count() }).from(dictionaryEntries).where(where),
  ]);
  return {
    items: rows.map(dictionaryDto),
    total: countRows[0]?.value ?? 0,
    engine: "postgresql",
  };
}

export function resetSearchClients(): void {
  meilisearch = undefined;
}
