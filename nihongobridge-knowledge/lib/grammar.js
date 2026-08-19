import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
import { jlptLevelEnum } from "./enums.js";
export const grammarPatterns = pgTable("grammar_patterns", {
    id: uuid("id").primaryKey().defaultRandom(),
    pattern: text("pattern").notNull(),
    patternPlain: text("pattern_plain"),
    meaning: jsonb("meaning")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    formation: text("formation"),
    formationDiagram: jsonb("formation_diagram").$type(),
    jlptLevel: jlptLevelEnum("jlpt_level").notNull().default("NONE"),
    examples: jsonb("examples")
        .$type()
        .notNull()
        .default(sql `'[]'::jsonb`),
    commonMistakes: text("common_mistakes"),
    relatedPatternIds: uuid("related_pattern_ids")
        .array()
        .notNull()
        .default(sql `ARRAY[]::uuid[]`),
    notes: text("notes"),
    audioUrl: text("audio_url"),
    tags: text("tags").array().notNull().default(sql `ARRAY[]::text[]`),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("grammar_patterns_pattern_source_uidx").on(table.pattern, table.source),
    index("grammar_patterns_level_idx").on(table.jlptLevel),
    index("grammar_patterns_pattern_trgm_idx").using("gin", sql `${table.pattern} gin_trgm_ops`),
    index("grammar_patterns_plain_trgm_idx").using("gin", sql `${table.patternPlain} gin_trgm_ops`),
    index("grammar_patterns_meaning_gin_idx").using("gin", table.meaning),
    index("grammar_patterns_examples_gin_idx").using("gin", table.examples),
    index("grammar_patterns_tags_gin_idx").using("gin", table.tags),
    index("grammar_patterns_fts_idx").using("gin", sql `(
        setweight(to_tsvector('simple', coalesce(${table.pattern}, '') || ' ' || coalesce(${table.patternPlain}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.meaning}::text, '')), 'B')
      )`),
    check("grammar_patterns_pattern_not_blank_check", sql `btrim(${table.pattern}) <> ''`),
    check("grammar_patterns_source_not_blank_check", sql `btrim(${table.source}) <> ''`),
    check("grammar_patterns_meaning_array_check", sql `jsonb_typeof(${table.meaning}) = 'array'`),
    check("grammar_patterns_examples_array_check", sql `jsonb_typeof(${table.examples}) = 'array'`),
    check("grammar_patterns_formation_diagram_object_check", sql `${table.formationDiagram} IS NULL OR jsonb_typeof(${table.formationDiagram}) = 'object'`),
]);
//# sourceMappingURL=grammar.js.map