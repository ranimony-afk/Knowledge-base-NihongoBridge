import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { grammarPatterns, users } from "@nihongobridge/knowledge";

export type AiExplanationKind = "tutor_chat" | "grammar" | "translation";

export interface AiExplanationResponse {
  text?: string;
  [key: string]: unknown;
}

export const aiExplanations = pgTable(
  "ai_explanations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<AiExplanationKind>().notNull(),
    cacheKey: text("cache_key").notNull(),
    grammarPatternId: uuid("grammar_pattern_id").references(() => grammarPatterns.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    language: text("language").notNull().default("en"),
    userLevel: text("user_level").notNull(),
    requestContext: jsonb("request_context")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    response: jsonb("response").$type<AiExplanationResponse>().notNull(),
    responseText: text("response_text"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_explanations_cache_key_uidx").on(table.cacheKey),
    index("ai_explanations_grammar_level_language_idx").on(
      table.grammarPatternId,
      table.userLevel,
      table.language,
    ),
    index("ai_explanations_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("ai_explanations_kind_expires_idx").on(table.kind, table.expiresAt),
    check(
      "ai_explanations_kind_check",
      sql`${table.kind} IN ('tutor_chat', 'grammar', 'translation')`,
    ),
    check("ai_explanations_cache_key_not_blank_check", sql`btrim(${table.cacheKey}) <> ''`),
    check("ai_explanations_language_check", sql`${table.language} IN ('en','ta','ml','hi','ja')`),
    check(
      "ai_explanations_level_check",
      sql`${table.userLevel} IN ('N5','N4','N3','N2','N1','NONE')`,
    ),
    check("ai_explanations_model_not_blank_check", sql`btrim(${table.model}) <> ''`),
    check("ai_explanations_prompt_version_not_blank_check", sql`btrim(${table.promptVersion}) <> ''`),
    check("ai_explanations_hit_count_check", sql`${table.hitCount} >= 0`),
    check("ai_explanations_request_context_object_check", sql`jsonb_typeof(${table.requestContext}) = 'object'`),
    check("ai_explanations_response_object_check", sql`jsonb_typeof(${table.response}) = 'object'`),
  ],
);
