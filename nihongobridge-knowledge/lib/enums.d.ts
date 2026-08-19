/** Ordered from introductory to advanced, plus unclassified content. */
export declare const JLPT_LEVELS: readonly ["N5", "N4", "N3", "N2", "N1", "NONE"];
export type JlptLevel = (typeof JLPT_LEVELS)[number];
export declare const jlptLevelEnum: import("drizzle-orm/pg-core").PgEnum<["N5", "N4", "N3", "N2", "N1", "NONE"]>;
/** Published tests must target a concrete JLPT level. */
export declare const JLPT_TEST_LEVELS: readonly ["N5", "N4", "N3", "N2", "N1"];
export type JlptTestLevel = (typeof JLPT_TEST_LEVELS)[number];
export declare const jlptTestLevelEnum: import("drizzle-orm/pg-core").PgEnum<["N5", "N4", "N3", "N2", "N1"]>;
export declare const TEST_TYPES: readonly ["mock_full", "section_only", "quick_drill", "adaptive"];
export type TestType = (typeof TEST_TYPES)[number];
export declare const testTypeEnum: import("drizzle-orm/pg-core").PgEnum<["mock_full", "section_only", "quick_drill", "adaptive"]>;
export declare const QUESTION_SECTION_TYPES: readonly ["vocabulary", "grammar", "reading", "listening"];
export type QuestionSectionType = (typeof QUESTION_SECTION_TYPES)[number];
export declare const questionSectionTypeEnum: import("drizzle-orm/pg-core").PgEnum<["vocabulary", "grammar", "reading", "listening"]>;
export declare const CONTENT_ITEM_TYPES: readonly ["word", "kanji", "grammar", "sentence"];
export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number];
export declare const contentItemTypeEnum: import("drizzle-orm/pg-core").PgEnum<["word", "kanji", "grammar", "sentence"]>;
export declare const SRS_CONFIDENCE_LEVELS: readonly ["again", "hard", "good", "easy"];
export type SrsConfidence = (typeof SRS_CONFIDENCE_LEVELS)[number];
export declare const srsConfidenceEnum: import("drizzle-orm/pg-core").PgEnum<["again", "hard", "good", "easy"]>;
export declare const PROGRESS_STATUSES: readonly ["not_started", "learning", "reviewing", "mastered"];
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];
export declare const progressStatusEnum: import("drizzle-orm/pg-core").PgEnum<["not_started", "learning", "reviewing", "mastered"]>;
export declare const MEDIA_FILE_TYPES: readonly ["audio", "image", "svg", "pdf", "video"];
export type MediaFileType = (typeof MEDIA_FILE_TYPES)[number];
export declare const mediaFileTypeEnum: import("drizzle-orm/pg-core").PgEnum<["audio", "image", "svg", "pdf", "video"]>;
/** Relationship kind for the normalized dictionary self-reference table. */
export declare const DICTIONARY_RELATION_TYPES: readonly ["synonym", "antonym"];
export type DictionaryRelationType = (typeof DICTIONARY_RELATION_TYPES)[number];
export declare const dictionaryRelationTypeEnum: import("drizzle-orm/pg-core").PgEnum<["synonym", "antonym"]>;
/** Relationship kind for normalized similar/lookalike kanji links. */
export declare const KANJI_RELATION_TYPES: readonly ["similar", "lookalike"];
export type KanjiRelationType = (typeof KANJI_RELATION_TYPES)[number];
export declare const kanjiRelationTypeEnum: import("drizzle-orm/pg-core").PgEnum<["similar", "lookalike"]>;
//# sourceMappingURL=enums.d.ts.map