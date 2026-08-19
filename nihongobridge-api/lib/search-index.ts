import type {
  DictionaryEntry,
  GrammarPattern,
  KanjiEntry,
  Sentence,
} from "@nihongobridge/knowledge";
import { Meilisearch } from "meilisearch";

export type GlobalSearchType = "word" | "kanji" | "grammar" | "sentence";

const indexNames: Record<GlobalSearchType, string> = {
  word: process.env.MEILISEARCH_DICTIONARY_INDEX ?? "dictionary",
  kanji: process.env.MEILISEARCH_KANJI_INDEX ?? "kanji",
  grammar: process.env.MEILISEARCH_GRAMMAR_INDEX ?? "grammar",
  sentence: process.env.MEILISEARCH_SENTENCES_INDEX ?? "sentences",
};

let client: Meilisearch | undefined;

export function getSearchIndexClient(): Meilisearch {
  if (client) return client;
  const host = process.env.MEILISEARCH_URL;
  if (!host) throw new Error("MEILISEARCH_URL is not configured");
  const apiKey = process.env.MEILISEARCH_KEY;
  client = new Meilisearch({ host, ...(apiKey ? { apiKey } : {}) });
  return client;
}

export async function configureSearchIndexes(): Promise<void> {
  const search = getSearchIndexClient();
  const tasks = await Promise.all([
    search.index(indexNames.word).updateSettings({
      searchableAttributes: ["word", "kana", "romaji", "meanings"],
      filterableAttributes: ["jlpt_level", "part_of_speech", "tags", "has_audio"],
      sortableAttributes: ["frequency_rank"],
    }),
    search.index(indexNames.kanji).updateSettings({
      searchableAttributes: ["character", "onyomi", "kunyomi", "meanings"],
      filterableAttributes: ["jlpt_level", "grade", "stroke_count", "radicals"],
      sortableAttributes: ["frequency_rank"],
    }),
    search.index(indexNames.grammar).updateSettings({
      searchableAttributes: ["pattern", "pattern_plain", "meaning"],
      filterableAttributes: ["jlpt_level", "tags"],
    }),
    search.index(indexNames.sentence).updateSettings({
      searchableAttributes: ["japanese", "translations"],
      filterableAttributes: ["jlpt_level", "tags"],
    }),
  ]);
  await Promise.all(tasks.map((task) => search.tasks.waitForTask(task.taskUid)));
}

export async function indexDictionaryDocuments(rows: DictionaryEntry[]): Promise<void> {
  const task = await getSearchIndexClient().index(indexNames.word).addDocuments(
    rows
      .filter((row) => row.isActive)
      .map((row) => ({
        id: row.id,
        word: row.word,
        kana: row.kana,
        romaji: row.romaji,
        meanings: row.meanings,
        jlpt_level: row.jlptLevel,
        part_of_speech: row.partOfSpeech,
        frequency_rank: row.frequencyRank,
        has_audio: Boolean(row.audioUrl),
        tags: row.tags,
      })),
    { primaryKey: "id" },
  );
  await getSearchIndexClient().tasks.waitForTask(task.taskUid);
}

export async function indexKanjiDocuments(rows: KanjiEntry[]): Promise<void> {
  const task = await getSearchIndexClient().index(indexNames.kanji).addDocuments(
    rows.map((row) => ({
      id: row.id,
      character: row.character,
      onyomi: row.onyomi,
      kunyomi: row.kunyomi,
      meanings: row.meanings,
      jlpt_level: row.jlptLevel,
      grade: row.grade,
      stroke_count: row.strokeCount,
      radicals: row.radicals,
      frequency_rank: row.frequencyRank,
    })),
    { primaryKey: "id" },
  );
  await getSearchIndexClient().tasks.waitForTask(task.taskUid);
}

export async function indexGrammarDocuments(rows: GrammarPattern[]): Promise<void> {
  const task = await getSearchIndexClient().index(indexNames.grammar).addDocuments(
    rows.map((row) => ({
      id: row.id,
      pattern: row.pattern,
      pattern_plain: row.patternPlain,
      meaning: row.meaning,
      jlpt_level: row.jlptLevel,
      tags: row.tags,
    })),
    { primaryKey: "id" },
  );
  await getSearchIndexClient().tasks.waitForTask(task.taskUid);
}

export async function indexSentenceDocuments(rows: Sentence[]): Promise<void> {
  const task = await getSearchIndexClient().index(indexNames.sentence).addDocuments(
    rows.map((row) => ({
      id: row.id,
      japanese: row.japanese,
      translations: row.translations,
      jlpt_level: row.jlptLevel,
      tags: row.tags,
    })),
    { primaryKey: "id" },
  );
  await getSearchIndexClient().tasks.waitForTask(task.taskUid);
}

export async function multiIndexSearch(parameters: {
  q: string;
  types: GlobalSearchType[];
  level?: string | undefined;
  limit: number;
}): Promise<{
  ids: Record<GlobalSearchType, string[]>;
  totals: Record<GlobalSearchType, number>;
}> {
  const queries = parameters.types.map((type) => ({
    indexUid: indexNames[type],
    q: parameters.q,
    limit: parameters.limit,
    attributesToRetrieve: ["id"],
    ...(parameters.level ? { filter: `jlpt_level = ${JSON.stringify(parameters.level)}` } : {}),
  }));
  const response = await getSearchIndexClient().multiSearch<{ queries: typeof queries }, { id: string }>({
    queries,
  });
  const ids: Record<GlobalSearchType, string[]> = {
    word: [],
    kanji: [],
    grammar: [],
    sentence: [],
  };
  const totals: Record<GlobalSearchType, number> = {
    word: 0,
    kanji: 0,
    grammar: 0,
    sentence: 0,
  };
  response.results.forEach((result, index) => {
    const type = parameters.types[index];
    if (!type) return;
    ids[type] = result.hits.map((hit) => String(hit.id));
    totals[type] = result.estimatedTotalHits ?? result.hits.length;
  });
  return { ids, totals };
}

export async function removeSearchDocument(
  type: GlobalSearchType,
  id: string,
): Promise<void> {
  const task = await getSearchIndexClient().index(indexNames[type]).deleteDocument(id);
  await getSearchIndexClient().tasks.waitForTask(task.taskUid);
}

export function resetSearchIndexClient(): void {
  client = undefined;
}
