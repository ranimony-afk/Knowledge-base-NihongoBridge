import { sql } from "drizzle-orm";
import { char, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
import { jlptLevelEnum } from "./enums.js";
export const kanjiEntries = pgTable("kanji_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    character: char("character", { length: 1 }).notNull(),
    unicode: text("unicode"),
    onyomi: text("onyomi").array().notNull().default(sql `ARRAY[]::text[]`),
    kunyomi: text("kunyomi").array().notNull().default(sql `ARRAY[]::text[]`),
    meanings: jsonb("meanings")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    jlptLevel: jlptLevelEnum("jlpt_level").notNull().default("NONE"),
    grade: integer("grade"),
    frequencyRank: integer("frequency_rank"),
    strokeCount: integer("stroke_count"),
    radicals: text("radicals").array().notNull().default(sql `ARRAY[]::text[]`),
    components: text("components").array().notNull().default(sql `ARRAY[]::text[]`),
    svgAnimationUrl: text("svg_animation_url"),
    strokeOrderUrl: text("stroke_order_url"),
    exampleWordIds: uuid("example_word_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    similarKanji: text("similar_kanji")
        .array()
        .notNull()
        .default(sql `ARRAY[]::text[]`),
    lookalikes: text("lookalikes")
        .array()
        .notNull()
        .default(sql `ARRAY[]::text[]`),
    mnemonics: jsonb("mnemonics")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    source: text("source").notNull().default("kanjidic2"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("kanji_entries_character_uidx").on(table.character),
    uniqueIndex("kanji_entries_unicode_uidx")
        .on(table.unicode)
        .where(sql `${table.unicode} IS NOT NULL`),
    index("kanji_entries_jlpt_frequency_idx").on(table.jlptLevel, table.frequencyRank),
    index("kanji_entries_grade_idx").on(table.grade),
    index("kanji_entries_stroke_count_idx").on(table.strokeCount),
    index("kanji_entries_meanings_gin_idx").using("gin", table.meanings),
    index("kanji_entries_onyomi_gin_idx").using("gin", table.onyomi),
    index("kanji_entries_kunyomi_gin_idx").using("gin", table.kunyomi),
    index("kanji_entries_radicals_gin_idx").using("gin", table.radicals),
    index("kanji_entries_components_gin_idx").using("gin", table.components),
    index("kanji_entries_meaning_fts_idx").using("gin", sql `to_tsvector('english', coalesce(${table.meanings}::text, ''))`),
    check("kanji_entries_grade_check", sql `${table.grade} IS NULL OR ${table.grade} BETWEEN 1 AND 9`),
    check("kanji_entries_frequency_rank_check", sql `${table.frequencyRank} IS NULL OR ${table.frequencyRank} > 0`),
    check("kanji_entries_stroke_count_check", sql `${table.strokeCount} IS NULL OR ${table.strokeCount} > 0`),
    check("kanji_entries_character_check", sql `char_length(btrim(${table.character})) = 1`),
    check("kanji_entries_meanings_array_check", sql `jsonb_typeof(${table.meanings}) = 'array'`),
    check("kanji_entries_mnemonics_array_check", sql `jsonb_typeof(${table.mnemonics}) = 'array'`),
    check("kanji_entries_source_not_blank_check", sql `btrim(${table.source}) <> ''`),
]);
//# sourceMappingURL=kanji.js.map