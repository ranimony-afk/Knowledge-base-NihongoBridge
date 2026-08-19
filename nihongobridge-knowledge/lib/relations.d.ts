/**
 * Normalized relation tables are the integrity-enforced source of truth.
 * UUID/text arrays on content tables are retained as denormalized read/import
 * projections and should be synchronized transactionally by application code.
 */
export declare const dictionaryEntryLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "dictionary_entry_links";
    schema: undefined;
    columns: {
        sourceEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "source_entry_id";
            tableName: "dictionary_entry_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        targetEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "target_entry_id";
            tableName: "dictionary_entry_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        relationType: import("drizzle-orm/pg-core").PgColumn<{
            name: "relation_type";
            tableName: "dictionary_entry_links";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "synonym" | "antonym";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["synonym", "antonym"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "dictionary_entry_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const sentenceVocabularyLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "sentence_vocabulary_links";
    schema: undefined;
    columns: {
        sentenceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "sentence_id";
            tableName: "sentence_vocabulary_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        dictionaryEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "dictionary_entry_id";
            tableName: "sentence_vocabulary_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "sentence_vocabulary_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const sentenceGrammarLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "sentence_grammar_links";
    schema: undefined;
    columns: {
        sentenceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "sentence_id";
            tableName: "sentence_grammar_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        grammarPatternId: import("drizzle-orm/pg-core").PgColumn<{
            name: "grammar_pattern_id";
            tableName: "sentence_grammar_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "sentence_grammar_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const dictionaryGrammarLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "dictionary_grammar_links";
    schema: undefined;
    columns: {
        dictionaryEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "dictionary_entry_id";
            tableName: "dictionary_grammar_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        grammarPatternId: import("drizzle-orm/pg-core").PgColumn<{
            name: "grammar_pattern_id";
            tableName: "dictionary_grammar_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "dictionary_grammar_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const dictionaryKanjiLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "dictionary_kanji_links";
    schema: undefined;
    columns: {
        dictionaryEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "dictionary_entry_id";
            tableName: "dictionary_kanji_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        kanjiEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "kanji_entry_id";
            tableName: "dictionary_kanji_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        exampleRank: import("drizzle-orm/pg-core").PgColumn<{
            name: "example_rank";
            tableName: "dictionary_kanji_links";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "dictionary_kanji_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const grammarPatternLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "grammar_pattern_links";
    schema: undefined;
    columns: {
        sourcePatternId: import("drizzle-orm/pg-core").PgColumn<{
            name: "source_pattern_id";
            tableName: "grammar_pattern_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        targetPatternId: import("drizzle-orm/pg-core").PgColumn<{
            name: "target_pattern_id";
            tableName: "grammar_pattern_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "grammar_pattern_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const kanjiEntryLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "kanji_entry_links";
    schema: undefined;
    columns: {
        sourceKanjiId: import("drizzle-orm/pg-core").PgColumn<{
            name: "source_kanji_id";
            tableName: "kanji_entry_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        targetKanjiId: import("drizzle-orm/pg-core").PgColumn<{
            name: "target_kanji_id";
            tableName: "kanji_entry_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        relationType: import("drizzle-orm/pg-core").PgColumn<{
            name: "relation_type";
            tableName: "kanji_entry_links";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "similar" | "lookalike";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["similar", "lookalike"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "kanji_entry_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const questionVocabularyLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "question_vocabulary_links";
    schema: undefined;
    columns: {
        questionId: import("drizzle-orm/pg-core").PgColumn<{
            name: "question_id";
            tableName: "question_vocabulary_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        dictionaryEntryId: import("drizzle-orm/pg-core").PgColumn<{
            name: "dictionary_entry_id";
            tableName: "question_vocabulary_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "question_vocabulary_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const questionGrammarLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "question_grammar_links";
    schema: undefined;
    columns: {
        questionId: import("drizzle-orm/pg-core").PgColumn<{
            name: "question_id";
            tableName: "question_grammar_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        grammarPatternId: import("drizzle-orm/pg-core").PgColumn<{
            name: "grammar_pattern_id";
            tableName: "question_grammar_links";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "question_grammar_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const dictionaryEntriesRelations: import("drizzle-orm").Relations<"dictionary_entries", {
    outgoingLexicalLinks: import("drizzle-orm").Many<"dictionary_entry_links">;
    incomingLexicalLinks: import("drizzle-orm").Many<"dictionary_entry_links">;
    sentenceLinks: import("drizzle-orm").Many<"sentence_vocabulary_links">;
    grammarLinks: import("drizzle-orm").Many<"dictionary_grammar_links">;
    kanjiLinks: import("drizzle-orm").Many<"dictionary_kanji_links">;
    questionLinks: import("drizzle-orm").Many<"question_vocabulary_links">;
}>;
export declare const dictionaryEntryLinksRelations: import("drizzle-orm").Relations<"dictionary_entry_links", {
    sourceEntry: import("drizzle-orm").One<"dictionary_entries", true>;
    targetEntry: import("drizzle-orm").One<"dictionary_entries", true>;
}>;
export declare const sentencesRelations: import("drizzle-orm").Relations<"sentences", {
    vocabularyLinks: import("drizzle-orm").Many<"sentence_vocabulary_links">;
    grammarLinks: import("drizzle-orm").Many<"sentence_grammar_links">;
}>;
export declare const sentenceVocabularyLinksRelations: import("drizzle-orm").Relations<"sentence_vocabulary_links", {
    sentence: import("drizzle-orm").One<"sentences", true>;
    dictionaryEntry: import("drizzle-orm").One<"dictionary_entries", true>;
}>;
export declare const sentenceGrammarLinksRelations: import("drizzle-orm").Relations<"sentence_grammar_links", {
    sentence: import("drizzle-orm").One<"sentences", true>;
    grammarPattern: import("drizzle-orm").One<"grammar_patterns", true>;
}>;
export declare const dictionaryGrammarLinksRelations: import("drizzle-orm").Relations<"dictionary_grammar_links", {
    dictionaryEntry: import("drizzle-orm").One<"dictionary_entries", true>;
    grammarPattern: import("drizzle-orm").One<"grammar_patterns", true>;
}>;
export declare const dictionaryKanjiLinksRelations: import("drizzle-orm").Relations<"dictionary_kanji_links", {
    dictionaryEntry: import("drizzle-orm").One<"dictionary_entries", true>;
    kanjiEntry: import("drizzle-orm").One<"kanji_entries", true>;
}>;
export declare const grammarPatternsRelations: import("drizzle-orm").Relations<"grammar_patterns", {
    sentenceLinks: import("drizzle-orm").Many<"sentence_grammar_links">;
    dictionaryLinks: import("drizzle-orm").Many<"dictionary_grammar_links">;
    questionLinks: import("drizzle-orm").Many<"question_grammar_links">;
    outgoingRelatedLinks: import("drizzle-orm").Many<"grammar_pattern_links">;
    incomingRelatedLinks: import("drizzle-orm").Many<"grammar_pattern_links">;
}>;
export declare const grammarPatternLinksRelations: import("drizzle-orm").Relations<"grammar_pattern_links", {
    sourcePattern: import("drizzle-orm").One<"grammar_patterns", true>;
    targetPattern: import("drizzle-orm").One<"grammar_patterns", true>;
}>;
export declare const kanjiEntriesRelations: import("drizzle-orm").Relations<"kanji_entries", {
    dictionaryLinks: import("drizzle-orm").Many<"dictionary_kanji_links">;
    outgoingRelatedLinks: import("drizzle-orm").Many<"kanji_entry_links">;
    incomingRelatedLinks: import("drizzle-orm").Many<"kanji_entry_links">;
}>;
export declare const kanjiEntryLinksRelations: import("drizzle-orm").Relations<"kanji_entry_links", {
    sourceKanji: import("drizzle-orm").One<"kanji_entries", true>;
    targetKanji: import("drizzle-orm").One<"kanji_entries", true>;
}>;
export declare const questionVocabularyLinksRelations: import("drizzle-orm").Relations<"question_vocabulary_links", {
    question: import("drizzle-orm").One<"questions", true>;
    dictionaryEntry: import("drizzle-orm").One<"dictionary_entries", true>;
}>;
export declare const questionGrammarLinksRelations: import("drizzle-orm").Relations<"question_grammar_links", {
    question: import("drizzle-orm").One<"questions", true>;
    grammarPattern: import("drizzle-orm").One<"grammar_patterns", true>;
}>;
export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    createdPracticeTests: import("drizzle-orm").Many<"practice_tests">;
    testSessions: import("drizzle-orm").Many<"test_sessions">;
    srsDecks: import("drizzle-orm").Many<"srs_decks">;
    srsCards: import("drizzle-orm").Many<"srs_cards">;
    srsReviewLogs: import("drizzle-orm").Many<"srs_review_logs">;
    progress: import("drizzle-orm").Many<"user_progress">;
    bookmarks: import("drizzle-orm").Many<"user_bookmarks">;
}>;
export declare const practiceTestsRelations: import("drizzle-orm").Relations<"practice_tests", {
    creator: import("drizzle-orm").One<"users", true>;
    questions: import("drizzle-orm").Many<"questions">;
    sessions: import("drizzle-orm").Many<"test_sessions">;
}>;
export declare const questionsRelations: import("drizzle-orm").Relations<"questions", {
    practiceTest: import("drizzle-orm").One<"practice_tests", false>;
    vocabularyLinks: import("drizzle-orm").Many<"question_vocabulary_links">;
    grammarLinks: import("drizzle-orm").Many<"question_grammar_links">;
}>;
export declare const testSessionsRelations: import("drizzle-orm").Relations<"test_sessions", {
    user: import("drizzle-orm").One<"users", true>;
    practiceTest: import("drizzle-orm").One<"practice_tests", true>;
}>;
export declare const srsDecksRelations: import("drizzle-orm").Relations<"srs_decks", {
    user: import("drizzle-orm").One<"users", true>;
    cards: import("drizzle-orm").Many<"srs_cards">;
}>;
export declare const srsCardsRelations: import("drizzle-orm").Relations<"srs_cards", {
    user: import("drizzle-orm").One<"users", true>;
    deck: import("drizzle-orm").One<"srs_decks", false>;
    reviewLogs: import("drizzle-orm").Many<"srs_review_logs">;
}>;
export declare const srsReviewLogsRelations: import("drizzle-orm").Relations<"srs_review_logs", {
    card: import("drizzle-orm").One<"srs_cards", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const userProgressRelations: import("drizzle-orm").Relations<"user_progress", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const userBookmarksRelations: import("drizzle-orm").Relations<"user_bookmarks", {
    user: import("drizzle-orm").One<"users", true>;
}>;
//# sourceMappingURL=relations.d.ts.map