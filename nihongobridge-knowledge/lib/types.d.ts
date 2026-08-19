/** JSON value helpers shared by schema JSONB columns. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export interface FuriganaSegment {
    base: string;
    ruby: string;
}
export interface DictionaryMeaning {
    lang: string;
    value: string;
    pos: string;
}
export interface PitchAccent {
    /** Accent pattern/mora drop position. Zero commonly denotes heiban. */
    position?: number;
    pattern?: string;
    dialect?: string;
    source?: string;
    audioUrl?: string;
    [key: string]: JsonValue | undefined;
}
export interface LocalizedMeaning {
    lang: string;
    value: string;
}
export interface KanjiMnemonic {
    source: string;
    text: string;
}
export interface FormationDiagram {
    type?: string;
    nodes?: JsonValue[];
    edges?: JsonValue[];
    [key: string]: JsonValue | undefined;
}
export interface Translation {
    lang: string;
    value: string;
}
export interface GrammarExample {
    jp: string;
    reading: string;
    translations: Translation[];
}
export interface PracticeTestSection {
    type: "vocabulary" | "grammar" | "reading" | "listening";
    time_minutes: number;
    question_ids: string[];
}
export interface DialogueLine {
    speaker: string;
    text: string;
    reading?: string;
}
export interface QuestionStimulus {
    kind?: "passage" | "audio" | "image" | "dialogue";
    passage?: string;
    passage_translations?: Translation[];
    transcript?: DialogueLine[];
    audio?: {
        url?: string;
        duration_ms?: number;
        replay_limit?: number;
    };
    image?: {
        url: string;
        alt?: string;
    };
    metadata?: Record<string, JsonValue>;
}
export interface QuestionOption {
    id: string;
    text_jp: string;
    text_en: string;
}
export interface TestSessionAnswer {
    question_id: string;
    selected: string;
    time_taken: number;
}
export interface TestSectionScore {
    score: number;
    max_score: number;
    correct?: number;
    total?: number;
}
export type TestScoresBySection = Record<string, TestSectionScore>;
//# sourceMappingURL=types.d.ts.map