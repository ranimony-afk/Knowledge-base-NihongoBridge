import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  contentItemTypeEnum,
  jlptLevelEnum,
  srsConfidenceEnum,
} from "./enums.js";
import { users } from "./users.js";

export const srsDecks = pgTable(
  "srs_decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    jlptLevel: jlptLevelEnum("jlpt_level").notNull().default("NONE"),
    cardCount: integer("card_count").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("srs_decks_user_name_uidx").on(table.userId, table.name),
    unique("srs_decks_id_user_unique").on(table.id, table.userId),
    index("srs_decks_public_level_idx")
      .on(table.jlptLevel, table.createdAt)
      .where(sql`${table.isPublic} = true`),
    check("srs_decks_name_not_blank_check", sql`btrim(${table.name}) <> ''`),
    check("srs_decks_card_count_check", sql`${table.cardCount} >= 0`),
  ],
);

export const srsCards = pgTable(
  "srs_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: contentItemTypeEnum("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(1),
    repetitions: integer("repetitions").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", {
      withTimezone: true,
      mode: "date",
    }),
    totalReviews: integer("total_reviews").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    mistakeCount: integer("mistake_count").notNull().default(0),
    averageTimeMs: integer("average_time_ms").notNull().default(0),
    confidence: srsConfidenceEnum("confidence"),
    deckId: uuid("deck_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "srs_cards_deck_owner_fk",
      columns: [table.deckId, table.userId],
      foreignColumns: [srsDecks.id, srsDecks.userId],
    }).onDelete("cascade"),
    uniqueIndex("srs_cards_user_item_uidx").on(
      table.userId,
      table.itemType,
      table.itemId,
    ),
    index("srs_cards_due_idx").on(
      table.userId,
      table.nextReviewAt,
      table.easeFactor,
    ),
    index("srs_cards_deck_due_idx").on(table.deckId, table.nextReviewAt),
    index("srs_cards_item_idx").on(table.itemType, table.itemId),
    index("srs_cards_last_reviewed_idx").on(table.userId, table.lastReviewedAt),
    check(
      "srs_cards_ease_factor_check",
      sql`${table.easeFactor} BETWEEN 1.3 AND 2.5`,
    ),
    check("srs_cards_interval_days_check", sql`${table.intervalDays} >= 1`),
    check("srs_cards_repetitions_check", sql`${table.repetitions} >= 0`),
    check("srs_cards_total_reviews_check", sql`${table.totalReviews} >= 0`),
    check("srs_cards_correct_count_check", sql`${table.correctCount} >= 0`),
    check("srs_cards_mistake_count_check", sql`${table.mistakeCount} >= 0`),
    check("srs_cards_average_time_check", sql`${table.averageTimeMs} >= 0`),
    check(
      "srs_cards_review_counts_check",
      sql`${table.correctCount} + ${table.mistakeCount} <= ${table.totalReviews}`,
    ),
  ],
);

/** Immutable review events used for daily/30-day SRS analytics. */
export const srsReviewLogs = pgTable(
  "srs_review_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => srsCards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    confidence: srsConfidenceEnum("confidence").notNull(),
    wasCorrect: boolean("was_correct").notNull(),
    timeTakenMs: integer("time_taken_ms").notNull(),
    previousIntervalDays: integer("previous_interval_days").notNull(),
    nextIntervalDays: integer("next_interval_days").notNull(),
    previousEaseFactor: doublePrecision("previous_ease_factor").notNull(),
    nextEaseFactor: doublePrecision("next_ease_factor").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("srs_review_logs_user_reviewed_idx").on(table.userId, table.reviewedAt),
    index("srs_review_logs_card_reviewed_idx").on(table.cardId, table.reviewedAt),
    check("srs_review_logs_time_taken_check", sql`${table.timeTakenMs} >= 0`),
    check(
      "srs_review_logs_interval_check",
      sql`${table.previousIntervalDays} >= 1 AND ${table.nextIntervalDays} >= 1`,
    ),
    check(
      "srs_review_logs_ease_check",
      sql`${table.previousEaseFactor} BETWEEN 1.3 AND 2.5 AND ${table.nextEaseFactor} BETWEEN 1.3 AND 2.5`,
    ),
  ],
);
