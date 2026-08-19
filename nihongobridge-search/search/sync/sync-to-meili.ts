import { pathToFileURL } from "node:url";

import { Command } from "commander";

import { closeClients, db, meilisearch } from "../lib/clients.js";
import { config, INDEXES } from "../lib/config.js";
import { configureIndexes } from "../setup/configure-indexes.js";
import {
  autocompleteDocument,
  dictionaryDocument,
  grammarDocument,
  kanjiDocument,
  sentenceDocument,
  type DictionaryRow,
  type GrammarRow,
  type KanjiRow,
  type SentenceRow,
} from "./documents.js";
import { acquireSyncLock, loadState, saveState, type SyncState } from "./state.js";

type SourceName = "dictionary" | "kanji" | "grammar" | "sentences";
interface ChangeEvent {
  table: SourceName;
  id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  changed_at?: string;
}

export async function syncAll(mode: "full" | "incremental"): Promise<void> {
  const release = await acquireSyncLock();
  const state = await loadState();
  try {
    await configureIndexes();
    for (const source of ["dictionary", "kanji", "grammar", "sentences"] as const) {
      const since = mode === "incremental" ? state.updatedAt[source] : undefined;
      await syncSource(source, since, state, mode === "full");
    }
    state.lastSuccessfulRun = new Date().toISOString();
    await saveState(state);
  } finally {
    await release();
  }
}

async function syncSource(
  source: SourceName,
  since: string | undefined,
  state: SyncState,
  reconcile: boolean,
): Promise<void> {
  const batchSize = config().SEARCH_BATCH_SIZE;
  let offset = 0;
  let processed = 0;
  let maxUpdatedAt = state.updatedAt[source];
  const activeIds = reconcile ? new Set<string>() : null;

  for (;;) {
    const rows = await fetchBatch(source, since, batchSize, offset);
    if (!rows.length) break;
    if (source === "dictionary") {
      const typed = rows as DictionaryRow[];
      const active = typed.filter((row) => row.is_active);
      const inactive = typed.filter((row) => !row.is_active).map((row) => row.id);
      active.forEach((row) => activeIds?.add(row.id));
      await addDocuments(INDEXES.dictionary, active.map(dictionaryDocument));
      await addDocuments(INDEXES.autocomplete, active.map(autocompleteDocument));
      await deleteDocuments(INDEXES.dictionary, inactive);
      await deleteDocuments(INDEXES.autocomplete, inactive);
    } else if (source === "kanji") {
      const typed = rows as KanjiRow[];
      typed.forEach((row) => activeIds?.add(row.id));
      await addDocuments(INDEXES.kanji, typed.map(kanjiDocument));
    } else if (source === "grammar") {
      const typed = rows as GrammarRow[];
      typed.forEach((row) => activeIds?.add(row.id));
      await addDocuments(INDEXES.grammar, typed.map(grammarDocument));
    } else {
      const typed = rows as SentenceRow[];
      typed.forEach((row) => activeIds?.add(row.id));
      await addDocuments(INDEXES.sentences, typed.map(sentenceDocument));
    }

    for (const row of rows) {
      const stamp = row.updated_at.toISOString();
      if (stamp > maxUpdatedAt) maxUpdatedAt = stamp;
    }
    processed += rows.length;
    offset += rows.length;
    console.info(`${source}: indexed ${processed.toLocaleString()} records`);
    if (rows.length < batchSize) break;
  }

  if (reconcile && activeIds) {
    if (source === "dictionary") {
      await reconcileIndex(INDEXES.dictionary, activeIds);
      await reconcileIndex(INDEXES.autocomplete, activeIds);
    } else {
      await reconcileIndex(INDEXES[source], activeIds);
    }
  }
  state.updatedAt[source] = maxUpdatedAt;
  await saveState(state);
  console.info(`${source}: complete (${processed.toLocaleString()} processed)`);
}

async function fetchBatch(
  source: SourceName,
  since: string | undefined,
  limit: number,
  offset: number,
): Promise<Array<DictionaryRow | KanjiRow | GrammarRow | SentenceRow>> {
  const database = db();
  const cutoff = since ? new Date(since) : null;
  if (source === "dictionary") {
    return database<DictionaryRow[]>`
      SELECT id::text, word, kana, romaji, meanings, jlpt_level::text,
             part_of_speech, frequency_rank, tags, audio_url, is_active, updated_at
      FROM dictionary_entries
      WHERE (${cutoff}::timestamptz IS NULL OR updated_at > ${cutoff})
      ORDER BY updated_at, id
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
  if (source === "kanji") {
    return database<KanjiRow[]>`
      SELECT id::text, character, onyomi, kunyomi, meanings, jlpt_level::text,
             grade, stroke_count, frequency_rank, updated_at
      FROM kanji_entries
      WHERE (${cutoff}::timestamptz IS NULL OR updated_at > ${cutoff})
      ORDER BY updated_at, id
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
  if (source === "grammar") {
    return database<GrammarRow[]>`
      SELECT id::text, pattern, pattern_plain, meaning, jlpt_level::text,
             tags, updated_at
      FROM grammar_patterns
      WHERE (${cutoff}::timestamptz IS NULL OR updated_at > ${cutoff})
      ORDER BY updated_at, id
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
  return database<SentenceRow[]>`
    SELECT id::text, japanese, translations, jlpt_level::text, tags, updated_at
    FROM sentences
    WHERE (${cutoff}::timestamptz IS NULL OR updated_at > ${cutoff})
    ORDER BY updated_at, id
    LIMIT ${limit} OFFSET ${offset}
  `;
}

async function addDocuments(indexName: string, documents: Record<string, unknown>[]): Promise<void> {
  if (!documents.length) return;
  const task = await meilisearch().index(indexName).addDocuments(documents, { primaryKey: "id" });
  await waitTask(task.taskUid, `add documents to ${indexName}`);
}

async function deleteDocuments(indexName: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const task = await meilisearch().index(indexName).deleteDocuments(ids);
  await waitTask(task.taskUid, `delete documents from ${indexName}`);
}

async function waitTask(taskUid: number, operation: string): Promise<void> {
  const task = await meilisearch().tasks.waitForTask(taskUid, {
    timeout: 120_000,
    interval: 100,
  });
  if (task.status === "failed") throw new Error(`${operation} failed: ${task.error?.message ?? "unknown task error"}`);
}

async function reconcileIndex(indexName: string, databaseIds: Set<string>): Promise<void> {
  const index = meilisearch().index(indexName);
  const indexedIds: string[] = [];
  const batchSize = config().SEARCH_BATCH_SIZE;
  for (let offset = 0; ; offset += batchSize) {
    const page = await index.getDocuments<{ id: string }>({
      limit: batchSize,
      offset,
      fields: ["id"],
    });
    indexedIds.push(...page.results.map((row) => String(row.id)));
    if (page.results.length < batchSize) break;
  }
  const stale = indexedIds.filter((id) => !databaseIds.has(id));
  for (let offset = 0; offset < stale.length; offset += batchSize) {
    await deleteDocuments(indexName, stale.slice(offset, offset + batchSize));
  }
  console.info(`${indexName}: reconciled ${stale.length.toLocaleString()} stale documents`);
}

export async function watchDatabase(): Promise<void> {
  await configureIndexes();
  const channel = config().SEARCH_NOTIFY_CHANNEL;
  const queue = new Map<string, ChangeEvent>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let processing = false;

  const flush = async () => {
    if (processing || !queue.size) return;
    processing = true;
    const events = [...queue.values()];
    queue.clear();
    try {
      for (const event of events) await syncEvent(event);
    } finally {
      processing = false;
      if (queue.size) void flush();
    }
  };

  await db().listen(channel, (payload) => {
    try {
      const event = JSON.parse(payload) as ChangeEvent;
      if (!["dictionary", "kanji", "grammar", "sentences"].includes(event.table)) return;
      queue.set(`${event.table}:${event.id}`, event);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 250);
    } catch (error) {
      console.warn("Ignored malformed database notification", error);
    }
  });
  console.info(`Listening for PostgreSQL notifications on ${channel}`);

  await new Promise<void>((resolve) => {
    const shutdown = () => resolve();
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
  if (timer) clearTimeout(timer);
  await flush();
}

async function syncEvent(event: ChangeEvent): Promise<void> {
  const indexName = INDEXES[event.table];
  if (event.operation === "DELETE") {
    await deleteDocuments(indexName, [event.id]);
    if (event.table === "dictionary") await deleteDocuments(INDEXES.autocomplete, [event.id]);
    return;
  }
  const rows = await fetchOne(event.table, event.id);
  const row = rows[0];
  if (!row) {
    await deleteDocuments(indexName, [event.id]);
    return;
  }
  if (event.table === "dictionary") {
    const typed = row as DictionaryRow;
    if (!typed.is_active) {
      await deleteDocuments(INDEXES.dictionary, [typed.id]);
      await deleteDocuments(INDEXES.autocomplete, [typed.id]);
    } else {
      await addDocuments(INDEXES.dictionary, [dictionaryDocument(typed)]);
      await addDocuments(INDEXES.autocomplete, [autocompleteDocument(typed)]);
    }
  } else if (event.table === "kanji") {
    await addDocuments(INDEXES.kanji, [kanjiDocument(row as KanjiRow)]);
  } else if (event.table === "grammar") {
    await addDocuments(INDEXES.grammar, [grammarDocument(row as GrammarRow)]);
  } else {
    await addDocuments(INDEXES.sentences, [sentenceDocument(row as SentenceRow)]);
  }
}

async function fetchOne(
  source: SourceName,
  id: string,
): Promise<Array<DictionaryRow | KanjiRow | GrammarRow | SentenceRow>> {
  const database = db();
  if (source === "dictionary") {
    return database<DictionaryRow[]>`SELECT id::text, word, kana, romaji, meanings, jlpt_level::text, part_of_speech, frequency_rank, tags, audio_url, is_active, updated_at FROM dictionary_entries WHERE id = ${id}::uuid`;
  }
  if (source === "kanji") {
    return database<KanjiRow[]>`SELECT id::text, character, onyomi, kunyomi, meanings, jlpt_level::text, grade, stroke_count, frequency_rank, updated_at FROM kanji_entries WHERE id = ${id}::uuid`;
  }
  if (source === "grammar") {
    return database<GrammarRow[]>`SELECT id::text, pattern, pattern_plain, meaning, jlpt_level::text, tags, updated_at FROM grammar_patterns WHERE id = ${id}::uuid`;
  }
  return database<SentenceRow[]>`SELECT id::text, japanese, translations, jlpt_level::text, tags, updated_at FROM sentences WHERE id = ${id}::uuid`;
}

async function main(): Promise<void> {
  const options = new Command()
    .option("--full", "sync all rows and reconcile deletions")
    .option("--incremental", "sync rows newer than the saved timestamp")
    .option("--watch", "listen for PostgreSQL change notifications")
    .parse()
    .opts<{ full?: boolean; incremental?: boolean; watch?: boolean }>();

  try {
    if (options.watch) await watchDatabase();
    else await syncAll(options.full ? "full" : "incremental");
  } finally {
    await closeClients();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
