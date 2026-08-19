import { pgEnum } from "drizzle-orm/pg-core";

/** Ordered from introductory to advanced, plus unclassified content. */
export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1", "NONE"] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];
export const jlptLevelEnum = pgEnum("jlpt_level", JLPT_LEVELS);

/** Published tests must target a concrete JLPT level. */
export const JLPT_TEST_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export type JlptTestLevel = (typeof JLPT_TEST_LEVELS)[number];
export const jlptTestLevelEnum = pgEnum("jlpt_test_level", JLPT_TEST_LEVELS);

export const TEST_TYPES = [
  "mock_full",
  "section_only",
  "quick_drill",
  "adaptive",
] as const;
export type TestType = (typeof TEST_TYPES)[number];
export const testTypeEnum = pgEnum("test_type", TEST_TYPES);

export const QUESTION_SECTION_TYPES = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
] as const;
export type QuestionSectionType = (typeof QUESTION_SECTION_TYPES)[number];
export const questionSectionTypeEnum = pgEnum(
  "question_section_type",
  QUESTION_SECTION_TYPES,
);

export const CONTENT_ITEM_TYPES = ["word", "kanji", "grammar", "sentence"] as const;
export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number];
export const contentItemTypeEnum = pgEnum("content_item_type", CONTENT_ITEM_TYPES);

export const SRS_CONFIDENCE_LEVELS = ["again", "hard", "good", "easy"] as const;
export type SrsConfidence = (typeof SRS_CONFIDENCE_LEVELS)[number];
export const srsConfidenceEnum = pgEnum("srs_confidence", SRS_CONFIDENCE_LEVELS);

export const PROGRESS_STATUSES = [
  "not_started",
  "learning",
  "reviewing",
  "mastered",
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];
export const progressStatusEnum = pgEnum("progress_status", PROGRESS_STATUSES);

export const MEDIA_FILE_TYPES = ["audio", "image", "svg", "pdf", "video"] as const;
export type MediaFileType = (typeof MEDIA_FILE_TYPES)[number];
export const mediaFileTypeEnum = pgEnum("media_file_type", MEDIA_FILE_TYPES);

/** Relationship kind for the normalized dictionary self-reference table. */
export const DICTIONARY_RELATION_TYPES = ["synonym", "antonym"] as const;
export type DictionaryRelationType = (typeof DICTIONARY_RELATION_TYPES)[number];
export const dictionaryRelationTypeEnum = pgEnum(
  "dictionary_relation_type",
  DICTIONARY_RELATION_TYPES,
);

/** Relationship kind for normalized similar/lookalike kanji links. */
export const KANJI_RELATION_TYPES = ["similar", "lookalike"] as const;
export type KanjiRelationType = (typeof KANJI_RELATION_TYPES)[number];
export const kanjiRelationTypeEnum = pgEnum(
  "kanji_relation_type",
  KANJI_RELATION_TYPES,
);
