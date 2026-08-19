import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
import { jlptLevelEnum } from "./enums.js";
export const sentences = pgTable("sentences", {
    id: uuid("id").primaryKey().defaultRandom(),
    japanese: text("japanese").notNull(),
    furiganaHtml: text("furigana_html"),
    translations: jsonb("translations")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    audioUrl: text("audio_url"),
    jlptLevel: jlptLevelEnum("jlpt_level").notNull().default("NONE"),
    grammarIds: uuid("grammar_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    vocabularyIds: uuid("vocabulary_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
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
}, (table) => [
    uniqueIndex("sentences_source_source_id_uidx")
        .on(table.source, table.sourceId)
        .where(sql `${table.sourceId} IS NOT NULL`),
    index("sentences_japanese_hash_idx")
        .using("hash", table.japanese),
    index("sentences_level_idx").on(table.jlptLevel),
    index("sentences_japanese_trgm_idx").using("gin", sql `${table.japanese} gin_trgm_ops`),
    index("sentences_translations_gin_idx").using("gin", table.translations),
    index("sentences_grammar_ids_gin_idx").using("gin", table.grammarIds),
    index("sentences_vocabulary_ids_gin_idx").using("gin", table.vocabularyIds),
    index("sentences_tags_gin_idx").using("gin", table.tags),
    index("sentences_fts_idx").using("gin", sql `(
        setweight(to_tsvector('simple', coalesce(${table.japanese}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.translations}::text, '')), 'B')
      )`),
    check("sentences_japanese_not_blank_check", sql `btrim(${table.japanese}) <> ''`),
    check("sentences_source_not_blank_check", sql `btrim(${table.source}) <> ''`),
    check("sentences_translations_array_check", sql `jsonb_typeof(${table.translations}) = 'array'`),
]);
//# sourceMappingURL=sentences.js.map