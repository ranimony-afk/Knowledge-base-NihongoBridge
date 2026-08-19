import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
import { jlptLevelEnum } from "./enums.js";
export const dictionaryEntries = pgTable("dictionary_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    word: text("word").notNull(),
    kana: text("kana"),
    romaji: text("romaji"),
    furigana: jsonb("furigana")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    meanings: jsonb("meanings")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    jlptLevel: jlptLevelEnum("jlpt_level").notNull().default("NONE"),
    partOfSpeech: text("part_of_speech")
        .array()
        .notNull()
        .default(sql `ARRAY[]::text[]`),
    pitchAccent: jsonb("pitch_accent").$type(),
    frequencyRank: integer("frequency_rank"),
    synonyms: uuid("synonyms")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    antonyms: uuid("antonyms")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    exampleSentenceIds: uuid("example_sentence_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    grammarIds: uuid("grammar_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    /** Unicode kanji characters; normalized UUID relations live in dictionary_entry_kanji. */
    kanjiIds: text("kanji_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::text[]`),
    audioUrl: text("audio_url"),
    tags: text("tags").array().notNull().default(sql `ARRAY[]::text[]`),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
    isActive: boolean("is_active").notNull().default(true),
}, (table) => [
    uniqueIndex("dictionary_entries_source_source_id_uidx")
        .on(table.source, table.sourceId)
        .where(sql `${table.sourceId} IS NOT NULL`),
    index("dictionary_entries_word_idx").on(table.word),
    index("dictionary_entries_kana_idx").on(table.kana),
    index("dictionary_entries_jlpt_frequency_idx").on(table.jlptLevel, table.frequencyRank),
    index("dictionary_entries_word_trgm_idx").using("gin", sql `${table.word} gin_trgm_ops`),
    index("dictionary_entries_kana_trgm_idx").using("gin", sql `${table.kana} gin_trgm_ops`),
    index("dictionary_entries_romaji_trgm_idx").using("gin", sql `${table.romaji} gin_trgm_ops`),
    index("dictionary_entries_meanings_gin_idx").using("gin", table.meanings),
    index("dictionary_entries_furigana_gin_idx").using("gin", table.furigana),
    index("dictionary_entries_pos_gin_idx").using("gin", table.partOfSpeech),
    index("dictionary_entries_tags_gin_idx").using("gin", table.tags),
    index("dictionary_entries_kanji_ids_gin_idx").using("gin", table.kanjiIds),
    index("dictionary_entries_fts_idx").using("gin", sql `(
        setweight(to_tsvector('simple', coalesce(${table.word}, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(${table.kana}, '') || ' ' || coalesce(${table.romaji}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${table.meanings}::text, '')), 'C')
      )`),
    check("dictionary_entries_frequency_rank_check", sql `${table.frequencyRank} IS NULL OR ${table.frequencyRank} > 0`),
    check("dictionary_entries_word_not_blank_check", sql `btrim(${table.word}) <> ''`),
    check("dictionary_entries_source_not_blank_check", sql `btrim(${table.source}) <> ''`),
    check("dictionary_entries_furigana_array_check", sql `jsonb_typeof(${table.furigana}) = 'array'`),
    check("dictionary_entries_meanings_array_check", sql `jsonb_typeof(${table.meanings}) = 'array'`),
    check("dictionary_entries_pitch_accent_object_check", sql `${table.pitchAccent} IS NULL OR jsonb_typeof(${table.pitchAccent}) = 'object'`),
]);
//# sourceMappingURL=dictionary.js.map