import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { dictionaryEntries } from "./dictionary.js";
import {
  dictionaryRelationTypeEnum,
  kanjiRelationTypeEnum,
} from "./enums.js";
import { grammarPatterns } from "./grammar.js";
import { kanjiEntries } from "./kanji.js";
import { sentences } from "./sentences.js";
import { srsCards, srsDecks, srsReviewLogs } from "./srs.js";
import { practiceTests, questions, testSessions } from "./tests.js";
import { userBookmarks, userProgress, users } from "./users.js";

/**
 * Normalized relation tables are the integrity-enforced source of truth.
 * UUID/text arrays on content tables are retained as denormalized read/import
 * projections and should be synchronized transactionally by application code.
 */
export const dictionaryEntryLinks = pgTable(
  "dictionary_entry_links",
  {
    sourceEntryId: uuid("source_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),
    targetEntryId: uuid("target_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),
    relationType: dictionaryRelationTypeEnum("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "dictionary_entry_links_pk",
      columns: [table.sourceEntryId, table.targetEntryId, table.relationType],
    }),
    index("dictionary_entry_links_target_idx").on(table.targetEntryId),
    check(
      "dictionary_entry_links_no_self_check",
      sql`${table.sourceEntryId} <> ${table.targetEntryId}`,
    ),
  ],
);

export const sentenceVocabularyLinks = pgTable(
  "sentence_vocabulary_links",
  {
    sentenceId: uuid("sentence_id")
      .notNull()
      .references(() => sentences.id, { onDelete: "cascade" }),
    dictionaryEntryId: uuid("dictionary_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "sentence_vocabulary_links_pk",
      columns: [table.sentenceId, table.dictionaryEntryId],
    }),
    index("sentence_vocabulary_dictionary_idx").on(table.dictionaryEntryId),
  ],
);

export const sentenceGrammarLinks = pgTable(
  "sentence_grammar_links",
  {
    sentenceId: uuid("sentence_id")
      .notNull()
      .references(() => sentences.id, { onDelete: "cascade" }),
    grammarPatternId: uuid("grammar_pattern_id")
      .notNull()
      .references(() => grammarPatterns.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "sentence_grammar_links_pk",
      columns: [table.sentenceId, table.grammarPatternId],
    }),
    index("sentence_grammar_pattern_idx").on(table.grammarPatternId),
  ],
);

export const dictionaryGrammarLinks = pgTable(
  "dictionary_grammar_links",
  {
    dictionaryEntryId: uuid("dictionary_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),
    grammarPatternId: uuid("grammar_pattern_id")
      .notNull()
      .references(() => grammarPatterns.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "dictionary_grammar_links_pk",
      columns: [table.dictionaryEntryId, table.grammarPatternId],
    }),
    index("dictionary_grammar_pattern_idx").on(table.grammarPatternId),
  ],
);

export const dictionaryKanjiLinks = pgTable(
  "dictionary_kanji_links",
  {
    dictionaryEntryId: uuid("dictionary_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),
    kanjiEntryId: uuid("kanji_entry_id")
      .notNull()
      .references(() => kanjiEntries.id, { onDelete: "cascade" }),
    /** Optional 1-based rank for the kanji entry's featured example words. */
    exampleRank: integer("example_rank"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "dictionary_kanji_links_pk",
      columns: [table.dictionaryEntryId, table.kanjiEntryId],
    }),
    index("dictionary_kanji_kanji_idx").on(table.kanjiEntryId),
    index("dictionary_kanji_examples_idx")
      .on(table.kanjiEntryId, table.exampleRank)
      .where(sql`${table.exampleRank} IS NOT NULL`),
    check(
      "dictionary_kanji_example_rank_check",
      sql`${table.exampleRank} IS NULL OR ${table.exampleRank} BETWEEN 1 AND 5`,
    ),
  ],
);

export const grammarPatternLinks = pgTable(
  "grammar_pattern_links",
  {
    sourcePatternId: uuid("source_pattern_id")
      .notNull()
      .references(() => grammarPatterns.id, { onDelete: "cascade" }),
    targetPatternId: uuid("target_pattern_id")
      .notNull()
      .references(() => grammarPatterns.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "grammar_pattern_links_pk",
      columns: [table.sourcePatternId, table.targetPatternId],
    }),
    index("grammar_pattern_links_target_idx").on(table.targetPatternId),
    check(
      "grammar_pattern_links_no_self_check",
      sql`${table.sourcePatternId} <> ${table.targetPatternId}`,
    ),
  ],
);

export const kanjiEntryLinks = pgTable(
  "kanji_entry_links",
  {
    sourceKanjiId: uuid("source_kanji_id")
      .notNull()
      .references(() => kanjiEntries.id, { onDelete: "cascade" }),
    targetKanjiId: uuid("target_kanji_id")
      .notNull()
      .references(() => kanjiEntries.id, { onDelete: "cascade" }),
    relationType: kanjiRelationTypeEnum("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "kanji_entry_links_pk",
      columns: [table.sourceKanjiId, table.targetKanjiId, table.relationType],
    }),
    index("kanji_entry_links_target_idx").on(table.targetKanjiId),
    check(
      "kanji_entry_links_no_self_check",
      sql`${table.sourceKanjiId} <> ${table.targetKanjiId}`,
    ),
  ],
);

export const questionVocabularyLinks = pgTable(
  "question_vocabulary_links",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    dictionaryEntryId: uuid("dictionary_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "question_vocabulary_links_pk",
      columns: [table.questionId, table.dictionaryEntryId],
    }),
    index("question_vocabulary_dictionary_idx").on(table.dictionaryEntryId),
  ],
);

export const questionGrammarLinks = pgTable(
  "question_grammar_links",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    grammarPatternId: uuid("grammar_pattern_id")
      .notNull()
      .references(() => grammarPatterns.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "question_grammar_links_pk",
      columns: [table.questionId, table.grammarPatternId],
    }),
    index("question_grammar_pattern_idx").on(table.grammarPatternId),
  ],
);

export const dictionaryEntriesRelations = relations(dictionaryEntries, ({ many }) => ({
  outgoingLexicalLinks: many(dictionaryEntryLinks, {
    relationName: "dictionarySourceEntry",
  }),
  incomingLexicalLinks: many(dictionaryEntryLinks, {
    relationName: "dictionaryTargetEntry",
  }),
  sentenceLinks: many(sentenceVocabularyLinks),
  grammarLinks: many(dictionaryGrammarLinks),
  kanjiLinks: many(dictionaryKanjiLinks),
  questionLinks: many(questionVocabularyLinks),
}));

export const dictionaryEntryLinksRelations = relations(
  dictionaryEntryLinks,
  ({ one }) => ({
    sourceEntry: one(dictionaryEntries, {
      fields: [dictionaryEntryLinks.sourceEntryId],
      references: [dictionaryEntries.id],
      relationName: "dictionarySourceEntry",
    }),
    targetEntry: one(dictionaryEntries, {
      fields: [dictionaryEntryLinks.targetEntryId],
      references: [dictionaryEntries.id],
      relationName: "dictionaryTargetEntry",
    }),
  }),
);

export const sentencesRelations = relations(sentences, ({ many }) => ({
  vocabularyLinks: many(sentenceVocabularyLinks),
  grammarLinks: many(sentenceGrammarLinks),
}));

export const sentenceVocabularyLinksRelations = relations(
  sentenceVocabularyLinks,
  ({ one }) => ({
    sentence: one(sentences, {
      fields: [sentenceVocabularyLinks.sentenceId],
      references: [sentences.id],
    }),
    dictionaryEntry: one(dictionaryEntries, {
      fields: [sentenceVocabularyLinks.dictionaryEntryId],
      references: [dictionaryEntries.id],
    }),
  }),
);

export const sentenceGrammarLinksRelations = relations(
  sentenceGrammarLinks,
  ({ one }) => ({
    sentence: one(sentences, {
      fields: [sentenceGrammarLinks.sentenceId],
      references: [sentences.id],
    }),
    grammarPattern: one(grammarPatterns, {
      fields: [sentenceGrammarLinks.grammarPatternId],
      references: [grammarPatterns.id],
    }),
  }),
);

export const dictionaryGrammarLinksRelations = relations(
  dictionaryGrammarLinks,
  ({ one }) => ({
    dictionaryEntry: one(dictionaryEntries, {
      fields: [dictionaryGrammarLinks.dictionaryEntryId],
      references: [dictionaryEntries.id],
    }),
    grammarPattern: one(grammarPatterns, {
      fields: [dictionaryGrammarLinks.grammarPatternId],
      references: [grammarPatterns.id],
    }),
  }),
);

export const dictionaryKanjiLinksRelations = relations(
  dictionaryKanjiLinks,
  ({ one }) => ({
    dictionaryEntry: one(dictionaryEntries, {
      fields: [dictionaryKanjiLinks.dictionaryEntryId],
      references: [dictionaryEntries.id],
    }),
    kanjiEntry: one(kanjiEntries, {
      fields: [dictionaryKanjiLinks.kanjiEntryId],
      references: [kanjiEntries.id],
    }),
  }),
);

export const grammarPatternsRelations = relations(grammarPatterns, ({ many }) => ({
  sentenceLinks: many(sentenceGrammarLinks),
  dictionaryLinks: many(dictionaryGrammarLinks),
  questionLinks: many(questionGrammarLinks),
  outgoingRelatedLinks: many(grammarPatternLinks, {
    relationName: "grammarSourcePattern",
  }),
  incomingRelatedLinks: many(grammarPatternLinks, {
    relationName: "grammarTargetPattern",
  }),
}));

export const grammarPatternLinksRelations = relations(
  grammarPatternLinks,
  ({ one }) => ({
    sourcePattern: one(grammarPatterns, {
      fields: [grammarPatternLinks.sourcePatternId],
      references: [grammarPatterns.id],
      relationName: "grammarSourcePattern",
    }),
    targetPattern: one(grammarPatterns, {
      fields: [grammarPatternLinks.targetPatternId],
      references: [grammarPatterns.id],
      relationName: "grammarTargetPattern",
    }),
  }),
);

export const kanjiEntriesRelations = relations(kanjiEntries, ({ many }) => ({
  dictionaryLinks: many(dictionaryKanjiLinks),
  outgoingRelatedLinks: many(kanjiEntryLinks, {
    relationName: "kanjiSourceEntry",
  }),
  incomingRelatedLinks: many(kanjiEntryLinks, {
    relationName: "kanjiTargetEntry",
  }),
}));

export const kanjiEntryLinksRelations = relations(kanjiEntryLinks, ({ one }) => ({
  sourceKanji: one(kanjiEntries, {
    fields: [kanjiEntryLinks.sourceKanjiId],
    references: [kanjiEntries.id],
    relationName: "kanjiSourceEntry",
  }),
  targetKanji: one(kanjiEntries, {
    fields: [kanjiEntryLinks.targetKanjiId],
    references: [kanjiEntries.id],
    relationName: "kanjiTargetEntry",
  }),
}));

export const questionVocabularyLinksRelations = relations(
  questionVocabularyLinks,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionVocabularyLinks.questionId],
      references: [questions.id],
    }),
    dictionaryEntry: one(dictionaryEntries, {
      fields: [questionVocabularyLinks.dictionaryEntryId],
      references: [dictionaryEntries.id],
    }),
  }),
);

export const questionGrammarLinksRelations = relations(
  questionGrammarLinks,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionGrammarLinks.questionId],
      references: [questions.id],
    }),
    grammarPattern: one(grammarPatterns, {
      fields: [questionGrammarLinks.grammarPatternId],
      references: [grammarPatterns.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  createdPracticeTests: many(practiceTests),
  testSessions: many(testSessions),
  srsDecks: many(srsDecks),
  srsCards: many(srsCards),
  srsReviewLogs: many(srsReviewLogs),
  progress: many(userProgress),
  bookmarks: many(userBookmarks),
}));

export const practiceTestsRelations = relations(practiceTests, ({ one, many }) => ({
  creator: one(users, {
    fields: [practiceTests.createdBy],
    references: [users.id],
  }),
  questions: many(questions),
  sessions: many(testSessions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  practiceTest: one(practiceTests, {
    fields: [questions.testId],
    references: [practiceTests.id],
  }),
  vocabularyLinks: many(questionVocabularyLinks),
  grammarLinks: many(questionGrammarLinks),
}));

export const testSessionsRelations = relations(testSessions, ({ one }) => ({
  user: one(users, {
    fields: [testSessions.userId],
    references: [users.id],
  }),
  practiceTest: one(practiceTests, {
    fields: [testSessions.testId],
    references: [practiceTests.id],
  }),
}));

export const srsDecksRelations = relations(srsDecks, ({ one, many }) => ({
  user: one(users, {
    fields: [srsDecks.userId],
    references: [users.id],
  }),
  cards: many(srsCards),
}));

export const srsCardsRelations = relations(srsCards, ({ one, many }) => ({
  user: one(users, {
    fields: [srsCards.userId],
    references: [users.id],
  }),
  deck: one(srsDecks, {
    fields: [srsCards.deckId, srsCards.userId],
    references: [srsDecks.id, srsDecks.userId],
  }),
  reviewLogs: many(srsReviewLogs),
}));

export const srsReviewLogsRelations = relations(srsReviewLogs, ({ one }) => ({
  card: one(srsCards, {
    fields: [srsReviewLogs.cardId],
    references: [srsCards.id],
  }),
  user: one(users, {
    fields: [srsReviewLogs.userId],
    references: [users.id],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
}));

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
  user: one(users, {
    fields: [userBookmarks.userId],
    references: [users.id],
  }),
}));
