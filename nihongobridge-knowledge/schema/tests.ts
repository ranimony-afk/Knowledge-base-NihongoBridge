import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  jlptLevelEnum,
  jlptTestLevelEnum,
  questionSectionTypeEnum,
  testTypeEnum,
} from "./enums.js";
import type {
  PracticeTestSection,
  QuestionOption,
  QuestionStimulus,
  TestScoresBySection,
  TestSessionAnswer,
} from "./types.js";
import { users } from "./users.js";

export const practiceTests = pgTable(
  "practice_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    level: jlptTestLevelEnum("level").notNull(),
    testType: testTypeEnum("test_type").notNull(),
    sections: jsonb("sections")
      .$type<PracticeTestSection[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    totalTimeMinutes: integer("total_time_minutes").notNull(),
    difficultyScore: doublePrecision("difficulty_score").notNull(),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("practice_tests_level_type_published_idx").on(
      table.level,
      table.testType,
      table.isPublished,
    ),
    index("practice_tests_created_by_idx").on(table.createdBy),
    index("practice_tests_tags_gin_idx").using("gin", table.tags),
    index("practice_tests_sections_gin_idx").using("gin", table.sections),
    check("practice_tests_title_not_blank_check", sql`btrim(${table.title}) <> ''`),
    check(
      "practice_tests_sections_array_check",
      sql`jsonb_typeof(${table.sections}) = 'array'`,
    ),
    check(
      "practice_tests_total_time_check",
      sql`${table.totalTimeMinutes} > 0`,
    ),
    check(
      "practice_tests_difficulty_score_check",
      sql`${table.difficultyScore} BETWEEN 0 AND 5`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id").references(() => practiceTests.id, {
      onDelete: "set null",
    }),
    sectionType: questionSectionTypeEnum("section_type").notNull(),
    questionJp: text("question_jp"),
    questionEn: text("question_en"),
    stimulus: jsonb("stimulus").$type<QuestionStimulus | null>(),
    options: jsonb("options")
      .$type<QuestionOption[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    correctAnswer: text("correct_answer").notNull(),
    explanationJp: text("explanation_jp"),
    explanationEn: text("explanation_en"),
    vocabularyIds: uuid("vocabulary_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    grammarIds: uuid("grammar_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    audioUrl: text("audio_url"),
    imageUrl: text("image_url"),
    difficulty: integer("difficulty").notNull().default(3),
    jlptLevel: jlptLevelEnum("jlpt_level").notNull().default("NONE"),
    timeLimitSeconds: integer("time_limit_seconds"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    source: text("source").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("questions_test_section_idx").on(table.testId, table.sectionType),
    index("questions_level_section_difficulty_idx").on(
      table.jlptLevel,
      table.sectionType,
      table.difficulty,
    ),
    index("questions_active_source_idx").on(table.isActive, table.source),
    index("questions_options_gin_idx").using("gin", table.options),
    index("questions_stimulus_gin_idx").using("gin", table.stimulus),
    index("questions_vocabulary_ids_gin_idx").using("gin", table.vocabularyIds),
    index("questions_grammar_ids_gin_idx").using("gin", table.grammarIds),
    index("questions_tags_gin_idx").using("gin", table.tags),
    index("questions_fts_idx").using(
      "gin",
      sql`(
        setweight(to_tsvector('simple', coalesce(${table.questionJp}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.questionEn}, '') || ' ' || coalesce(${table.explanationEn}, '')), 'B')
      )`,
    ),
    check(
      "questions_text_present_check",
      sql`coalesce(btrim(${table.questionJp}), '') <> '' OR coalesce(btrim(${table.questionEn}), '') <> ''`,
    ),
    check("questions_options_array_check", sql`jsonb_typeof(${table.options}) = 'array'`),
    check(
      "questions_options_count_check",
      sql`jsonb_array_length(${table.options}) BETWEEN 2 AND 8`,
    ),
    check(
      "questions_correct_answer_exists_check",
      sql`${table.options} @> jsonb_build_array(jsonb_build_object('id', ${table.correctAnswer}))`,
    ),
    check(
      "questions_stimulus_object_check",
      sql`${table.stimulus} IS NULL OR jsonb_typeof(${table.stimulus}) = 'object'`,
    ),
    check("questions_difficulty_check", sql`${table.difficulty} BETWEEN 1 AND 5`),
    check(
      "questions_time_limit_check",
      sql`${table.timeLimitSeconds} IS NULL OR ${table.timeLimitSeconds} > 0`,
    ),
    check(
      "questions_source_check",
      sql`${table.source} IN ('original', 'generated')`,
    ),
  ],
);

export const testSessions = pgTable(
  "test_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testId: uuid("test_id")
      .notNull()
      .references(() => practiceTests.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    answers: jsonb("answers")
      .$type<TestSessionAnswer[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    scoreTotal: doublePrecision("score_total"),
    scoreBySection: jsonb("score_by_section").$type<TestScoresBySection | null>(),
    passed: boolean("passed"),
    reviewMode: boolean("review_mode").notNull().default(false),
  },
  (table) => [
    index("test_sessions_user_started_idx").on(table.userId, table.startedAt.desc()),
    index("test_sessions_test_completed_idx").on(table.testId, table.completedAt),
    index("test_sessions_incomplete_idx")
      .on(table.userId, table.startedAt)
      .where(sql`${table.completedAt} IS NULL`),
    index("test_sessions_answers_gin_idx").using("gin", table.answers),
    check("test_sessions_time_spent_check", sql`${table.timeSpentSeconds} >= 0`),
    check(
      "test_sessions_completed_after_start_check",
      sql`${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`,
    ),
    check(
      "test_sessions_answers_array_check",
      sql`jsonb_typeof(${table.answers}) = 'array'`,
    ),
    check(
      "test_sessions_score_total_check",
      sql`${table.scoreTotal} IS NULL OR ${table.scoreTotal} BETWEEN 0 AND 180`,
    ),
    check(
      "test_sessions_score_by_section_object_check",
      sql`${table.scoreBySection} IS NULL OR jsonb_typeof(${table.scoreBySection}) = 'object'`,
    ),
  ],
);
