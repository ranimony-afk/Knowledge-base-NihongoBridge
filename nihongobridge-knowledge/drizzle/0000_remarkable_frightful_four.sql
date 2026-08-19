CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE TYPE "public"."content_item_type" AS ENUM('word', 'kanji', 'grammar', 'sentence');--> statement-breakpoint
CREATE TYPE "public"."dictionary_relation_type" AS ENUM('synonym', 'antonym');--> statement-breakpoint
CREATE TYPE "public"."jlpt_level" AS ENUM('N5', 'N4', 'N3', 'N2', 'N1', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."jlpt_test_level" AS ENUM('N5', 'N4', 'N3', 'N2', 'N1');--> statement-breakpoint
CREATE TYPE "public"."kanji_relation_type" AS ENUM('similar', 'lookalike');--> statement-breakpoint
CREATE TYPE "public"."media_file_type" AS ENUM('audio', 'image', 'svg', 'pdf', 'video');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('not_started', 'learning', 'reviewing', 'mastered');--> statement-breakpoint
CREATE TYPE "public"."question_section_type" AS ENUM('vocabulary', 'grammar', 'reading', 'listening');--> statement-breakpoint
CREATE TYPE "public"."srs_confidence" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."test_type" AS ENUM('mock_full', 'section_only', 'quick_drill', 'adaptive');--> statement-breakpoint
CREATE TABLE "dictionary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" text NOT NULL,
	"kana" text,
	"romaji" text,
	"furigana" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meanings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jlpt_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"part_of_speech" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"pitch_accent" jsonb,
	"frequency_rank" integer,
	"synonyms" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"antonyms" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"example_sentence_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"grammar_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"kanji_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"audio_url" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dictionary_entries_frequency_rank_check" CHECK ("dictionary_entries"."frequency_rank" IS NULL OR "dictionary_entries"."frequency_rank" > 0),
	CONSTRAINT "dictionary_entries_word_not_blank_check" CHECK (btrim("dictionary_entries"."word") <> ''),
	CONSTRAINT "dictionary_entries_source_not_blank_check" CHECK (btrim("dictionary_entries"."source") <> ''),
	CONSTRAINT "dictionary_entries_furigana_array_check" CHECK (jsonb_typeof("dictionary_entries"."furigana") = 'array'),
	CONSTRAINT "dictionary_entries_meanings_array_check" CHECK (jsonb_typeof("dictionary_entries"."meanings") = 'array'),
	CONSTRAINT "dictionary_entries_pitch_accent_object_check" CHECK ("dictionary_entries"."pitch_accent" IS NULL OR jsonb_typeof("dictionary_entries"."pitch_accent") = 'object')
);
--> statement-breakpoint
CREATE TABLE "grammar_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern" text NOT NULL,
	"pattern_plain" text,
	"meaning" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"formation" text,
	"formation_diagram" jsonb,
	"jlpt_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"common_mistakes" text,
	"related_pattern_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"notes" text,
	"audio_url" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grammar_patterns_pattern_not_blank_check" CHECK (btrim("grammar_patterns"."pattern") <> ''),
	CONSTRAINT "grammar_patterns_source_not_blank_check" CHECK (btrim("grammar_patterns"."source") <> ''),
	CONSTRAINT "grammar_patterns_meaning_array_check" CHECK (jsonb_typeof("grammar_patterns"."meaning") = 'array'),
	CONSTRAINT "grammar_patterns_examples_array_check" CHECK (jsonb_typeof("grammar_patterns"."examples") = 'array'),
	CONSTRAINT "grammar_patterns_formation_diagram_object_check" CHECK ("grammar_patterns"."formation_diagram" IS NULL OR jsonb_typeof("grammar_patterns"."formation_diagram") = 'object')
);
--> statement-breakpoint
CREATE TABLE "kanji_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character" char(1) NOT NULL,
	"unicode" text,
	"onyomi" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"kunyomi" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"meanings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jlpt_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"grade" integer,
	"frequency_rank" integer,
	"stroke_count" integer,
	"radicals" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"components" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"svg_animation_url" text,
	"stroke_order_url" text,
	"example_word_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"similar_kanji" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"lookalikes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"mnemonics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'kanjidic2' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kanji_entries_grade_check" CHECK ("kanji_entries"."grade" IS NULL OR "kanji_entries"."grade" BETWEEN 1 AND 9),
	CONSTRAINT "kanji_entries_frequency_rank_check" CHECK ("kanji_entries"."frequency_rank" IS NULL OR "kanji_entries"."frequency_rank" > 0),
	CONSTRAINT "kanji_entries_stroke_count_check" CHECK ("kanji_entries"."stroke_count" IS NULL OR "kanji_entries"."stroke_count" > 0),
	CONSTRAINT "kanji_entries_character_check" CHECK (char_length(btrim("kanji_entries"."character")) = 1),
	CONSTRAINT "kanji_entries_meanings_array_check" CHECK (jsonb_typeof("kanji_entries"."meanings") = 'array'),
	CONSTRAINT "kanji_entries_mnemonics_array_check" CHECK (jsonb_typeof("kanji_entries"."mnemonics") = 'array'),
	CONSTRAINT "kanji_entries_source_not_blank_check" CHECK (btrim("kanji_entries"."source") <> '')
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"file_type" "media_file_type" NOT NULL,
	"mime_type" text NOT NULL,
	"url" text NOT NULL,
	"storage_path" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"duration_ms" integer,
	"related_item_type" text,
	"related_item_id" uuid,
	"language" text DEFAULT 'ja' NOT NULL,
	"voice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_filename_not_blank_check" CHECK (btrim("media_assets"."filename") <> ''),
	CONSTRAINT "media_assets_mime_type_not_blank_check" CHECK (btrim("media_assets"."mime_type") <> ''),
	CONSTRAINT "media_assets_url_not_blank_check" CHECK (btrim("media_assets"."url") <> ''),
	CONSTRAINT "media_assets_storage_path_not_blank_check" CHECK (btrim("media_assets"."storage_path") <> ''),
	CONSTRAINT "media_assets_size_bytes_check" CHECK ("media_assets"."size_bytes" >= 0),
	CONSTRAINT "media_assets_duration_check" CHECK ("media_assets"."duration_ms" IS NULL OR "media_assets"."duration_ms" >= 0),
	CONSTRAINT "media_assets_related_pair_check" CHECK (("media_assets"."related_item_type" IS NULL) = ("media_assets"."related_item_id" IS NULL)),
	CONSTRAINT "media_assets_language_not_blank_check" CHECK (btrim("media_assets"."language") <> '')
);
--> statement-breakpoint
CREATE TABLE "dictionary_entry_links" (
	"source_entry_id" uuid NOT NULL,
	"target_entry_id" uuid NOT NULL,
	"relation_type" "dictionary_relation_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dictionary_entry_links_pk" PRIMARY KEY("source_entry_id","target_entry_id","relation_type"),
	CONSTRAINT "dictionary_entry_links_no_self_check" CHECK ("dictionary_entry_links"."source_entry_id" <> "dictionary_entry_links"."target_entry_id")
);
--> statement-breakpoint
CREATE TABLE "dictionary_grammar_links" (
	"dictionary_entry_id" uuid NOT NULL,
	"grammar_pattern_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dictionary_grammar_links_pk" PRIMARY KEY("dictionary_entry_id","grammar_pattern_id")
);
--> statement-breakpoint
CREATE TABLE "dictionary_kanji_links" (
	"dictionary_entry_id" uuid NOT NULL,
	"kanji_entry_id" uuid NOT NULL,
	"example_rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dictionary_kanji_links_pk" PRIMARY KEY("dictionary_entry_id","kanji_entry_id"),
	CONSTRAINT "dictionary_kanji_example_rank_check" CHECK ("dictionary_kanji_links"."example_rank" IS NULL OR "dictionary_kanji_links"."example_rank" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "grammar_pattern_links" (
	"source_pattern_id" uuid NOT NULL,
	"target_pattern_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grammar_pattern_links_pk" PRIMARY KEY("source_pattern_id","target_pattern_id"),
	CONSTRAINT "grammar_pattern_links_no_self_check" CHECK ("grammar_pattern_links"."source_pattern_id" <> "grammar_pattern_links"."target_pattern_id")
);
--> statement-breakpoint
CREATE TABLE "kanji_entry_links" (
	"source_kanji_id" uuid NOT NULL,
	"target_kanji_id" uuid NOT NULL,
	"relation_type" "kanji_relation_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kanji_entry_links_pk" PRIMARY KEY("source_kanji_id","target_kanji_id","relation_type"),
	CONSTRAINT "kanji_entry_links_no_self_check" CHECK ("kanji_entry_links"."source_kanji_id" <> "kanji_entry_links"."target_kanji_id")
);
--> statement-breakpoint
CREATE TABLE "question_grammar_links" (
	"question_id" uuid NOT NULL,
	"grammar_pattern_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_grammar_links_pk" PRIMARY KEY("question_id","grammar_pattern_id")
);
--> statement-breakpoint
CREATE TABLE "question_vocabulary_links" (
	"question_id" uuid NOT NULL,
	"dictionary_entry_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_vocabulary_links_pk" PRIMARY KEY("question_id","dictionary_entry_id")
);
--> statement-breakpoint
CREATE TABLE "sentence_grammar_links" (
	"sentence_id" uuid NOT NULL,
	"grammar_pattern_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sentence_grammar_links_pk" PRIMARY KEY("sentence_id","grammar_pattern_id")
);
--> statement-breakpoint
CREATE TABLE "sentence_vocabulary_links" (
	"sentence_id" uuid NOT NULL,
	"dictionary_entry_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sentence_vocabulary_links_pk" PRIMARY KEY("sentence_id","dictionary_entry_id")
);
--> statement-breakpoint
CREATE TABLE "sentences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"japanese" text NOT NULL,
	"furigana_html" text,
	"translations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audio_url" text,
	"jlpt_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"grammar_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"vocabulary_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sentences_japanese_not_blank_check" CHECK (btrim("sentences"."japanese") <> ''),
	CONSTRAINT "sentences_source_not_blank_check" CHECK (btrim("sentences"."source") <> ''),
	CONSTRAINT "sentences_translations_array_check" CHECK (jsonb_typeof("sentences"."translations") = 'array')
);
--> statement-breakpoint
CREATE TABLE "srs_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" "content_item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"ease_factor" double precision DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"mistake_count" integer DEFAULT 0 NOT NULL,
	"average_time_ms" integer DEFAULT 0 NOT NULL,
	"confidence" "srs_confidence",
	"deck_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "srs_cards_ease_factor_check" CHECK ("srs_cards"."ease_factor" BETWEEN 1.3 AND 2.5),
	CONSTRAINT "srs_cards_interval_days_check" CHECK ("srs_cards"."interval_days" >= 1),
	CONSTRAINT "srs_cards_repetitions_check" CHECK ("srs_cards"."repetitions" >= 0),
	CONSTRAINT "srs_cards_total_reviews_check" CHECK ("srs_cards"."total_reviews" >= 0),
	CONSTRAINT "srs_cards_correct_count_check" CHECK ("srs_cards"."correct_count" >= 0),
	CONSTRAINT "srs_cards_mistake_count_check" CHECK ("srs_cards"."mistake_count" >= 0),
	CONSTRAINT "srs_cards_average_time_check" CHECK ("srs_cards"."average_time_ms" >= 0),
	CONSTRAINT "srs_cards_review_counts_check" CHECK ("srs_cards"."correct_count" + "srs_cards"."mistake_count" <= "srs_cards"."total_reviews")
);
--> statement-breakpoint
CREATE TABLE "srs_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"jlpt_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"card_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "srs_decks_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "srs_decks_name_not_blank_check" CHECK (btrim("srs_decks"."name") <> ''),
	CONSTRAINT "srs_decks_card_count_check" CHECK ("srs_decks"."card_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "practice_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"level" "jlpt_test_level" NOT NULL,
	"test_type" "test_type" NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_time_minutes" integer NOT NULL,
	"difficulty_score" double precision NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_tests_title_not_blank_check" CHECK (btrim("practice_tests"."title") <> ''),
	CONSTRAINT "practice_tests_sections_array_check" CHECK (jsonb_typeof("practice_tests"."sections") = 'array'),
	CONSTRAINT "practice_tests_total_time_check" CHECK ("practice_tests"."total_time_minutes" > 0),
	CONSTRAINT "practice_tests_difficulty_score_check" CHECK ("practice_tests"."difficulty_score" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid,
	"section_type" "question_section_type" NOT NULL,
	"question_jp" text,
	"question_en" text,
	"stimulus" jsonb,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation_jp" text,
	"explanation_en" text,
	"vocabulary_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"grammar_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"audio_url" text,
	"image_url" text,
	"difficulty" integer DEFAULT 3 NOT NULL,
	"jlpt_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"time_limit_seconds" integer,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"source" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_text_present_check" CHECK (coalesce(btrim("questions"."question_jp"), '') <> '' OR coalesce(btrim("questions"."question_en"), '') <> ''),
	CONSTRAINT "questions_options_array_check" CHECK (jsonb_typeof("questions"."options") = 'array'),
	CONSTRAINT "questions_options_count_check" CHECK (jsonb_array_length("questions"."options") BETWEEN 2 AND 8),
	CONSTRAINT "questions_correct_answer_exists_check" CHECK ("questions"."options" @> jsonb_build_array(jsonb_build_object('id', "questions"."correct_answer"))),
	CONSTRAINT "questions_stimulus_object_check" CHECK ("questions"."stimulus" IS NULL OR jsonb_typeof("questions"."stimulus") = 'object'),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" BETWEEN 1 AND 5),
	CONSTRAINT "questions_time_limit_check" CHECK ("questions"."time_limit_seconds" IS NULL OR "questions"."time_limit_seconds" > 0),
	CONSTRAINT "questions_source_check" CHECK ("questions"."source" IN ('original', 'generated'))
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score_total" double precision,
	"score_by_section" jsonb,
	"passed" boolean,
	"review_mode" boolean DEFAULT false NOT NULL,
	CONSTRAINT "test_sessions_time_spent_check" CHECK ("test_sessions"."time_spent_seconds" >= 0),
	CONSTRAINT "test_sessions_completed_after_start_check" CHECK ("test_sessions"."completed_at" IS NULL OR "test_sessions"."completed_at" >= "test_sessions"."started_at"),
	CONSTRAINT "test_sessions_answers_array_check" CHECK (jsonb_typeof("test_sessions"."answers") = 'array'),
	CONSTRAINT "test_sessions_score_total_check" CHECK ("test_sessions"."score_total" IS NULL OR "test_sessions"."score_total" BETWEEN 0 AND 180),
	CONSTRAINT "test_sessions_score_by_section_object_check" CHECK ("test_sessions"."score_by_section" IS NULL OR jsonb_typeof("test_sessions"."score_by_section") = 'object')
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" "content_item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"collection_name" text DEFAULT 'Default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_bookmarks_collection_not_blank_check" CHECK (btrim("user_bookmarks"."collection_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" "content_item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"status" "progress_status" DEFAULT 'not_started' NOT NULL,
	"accuracy" double precision DEFAULT 0 NOT NULL,
	"study_count" integer DEFAULT 0 NOT NULL,
	"last_studied_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "user_progress_accuracy_check" CHECK ("user_progress"."accuracy" BETWEEN 0 AND 1),
	CONSTRAINT "user_progress_study_count_check" CHECK ("user_progress"."study_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"target_level" "jlpt_level" DEFAULT 'N5' NOT NULL,
	"current_level" "jlpt_level" DEFAULT 'NONE' NOT NULL,
	"study_languages" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_study_date" date,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_shape_check" CHECK (btrim("users"."email") <> '' AND position('@' in "users"."email") > 1),
	CONSTRAINT "users_username_not_blank_check" CHECK (btrim("users"."username") <> ''),
	CONSTRAINT "users_streak_days_check" CHECK ("users"."streak_days" >= 0),
	CONSTRAINT "users_xp_total_check" CHECK ("users"."xp_total" >= 0),
	CONSTRAINT "users_study_languages_check" CHECK (cardinality("users"."study_languages") > 0 AND "users"."study_languages" <@ ARRAY['en','ta','ml','hi']::text[])
);
--> statement-breakpoint
ALTER TABLE "dictionary_entry_links" ADD CONSTRAINT "dictionary_entry_links_source_entry_id_dictionary_entries_id_fk" FOREIGN KEY ("source_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_entry_links" ADD CONSTRAINT "dictionary_entry_links_target_entry_id_dictionary_entries_id_fk" FOREIGN KEY ("target_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_grammar_links" ADD CONSTRAINT "dictionary_grammar_links_dictionary_entry_id_dictionary_entries_id_fk" FOREIGN KEY ("dictionary_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_grammar_links" ADD CONSTRAINT "dictionary_grammar_links_grammar_pattern_id_grammar_patterns_id_fk" FOREIGN KEY ("grammar_pattern_id") REFERENCES "public"."grammar_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_kanji_links" ADD CONSTRAINT "dictionary_kanji_links_dictionary_entry_id_dictionary_entries_id_fk" FOREIGN KEY ("dictionary_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_kanji_links" ADD CONSTRAINT "dictionary_kanji_links_kanji_entry_id_kanji_entries_id_fk" FOREIGN KEY ("kanji_entry_id") REFERENCES "public"."kanji_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_pattern_links" ADD CONSTRAINT "grammar_pattern_links_source_pattern_id_grammar_patterns_id_fk" FOREIGN KEY ("source_pattern_id") REFERENCES "public"."grammar_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_pattern_links" ADD CONSTRAINT "grammar_pattern_links_target_pattern_id_grammar_patterns_id_fk" FOREIGN KEY ("target_pattern_id") REFERENCES "public"."grammar_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanji_entry_links" ADD CONSTRAINT "kanji_entry_links_source_kanji_id_kanji_entries_id_fk" FOREIGN KEY ("source_kanji_id") REFERENCES "public"."kanji_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanji_entry_links" ADD CONSTRAINT "kanji_entry_links_target_kanji_id_kanji_entries_id_fk" FOREIGN KEY ("target_kanji_id") REFERENCES "public"."kanji_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_grammar_links" ADD CONSTRAINT "question_grammar_links_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_grammar_links" ADD CONSTRAINT "question_grammar_links_grammar_pattern_id_grammar_patterns_id_fk" FOREIGN KEY ("grammar_pattern_id") REFERENCES "public"."grammar_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_vocabulary_links" ADD CONSTRAINT "question_vocabulary_links_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_vocabulary_links" ADD CONSTRAINT "question_vocabulary_links_dictionary_entry_id_dictionary_entries_id_fk" FOREIGN KEY ("dictionary_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_grammar_links" ADD CONSTRAINT "sentence_grammar_links_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_grammar_links" ADD CONSTRAINT "sentence_grammar_links_grammar_pattern_id_grammar_patterns_id_fk" FOREIGN KEY ("grammar_pattern_id") REFERENCES "public"."grammar_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_vocabulary_links" ADD CONSTRAINT "sentence_vocabulary_links_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_vocabulary_links" ADD CONSTRAINT "sentence_vocabulary_links_dictionary_entry_id_dictionary_entries_id_fk" FOREIGN KEY ("dictionary_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_deck_owner_fk" FOREIGN KEY ("deck_id","user_id") REFERENCES "public"."srs_decks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_decks" ADD CONSTRAINT "srs_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tests" ADD CONSTRAINT "practice_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_test_id_practice_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."practice_tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_test_id_practice_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."practice_tests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dictionary_entries_source_source_id_uidx" ON "dictionary_entries" USING btree ("source","source_id") WHERE "dictionary_entries"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "dictionary_entries_word_idx" ON "dictionary_entries" USING btree ("word");--> statement-breakpoint
CREATE INDEX "dictionary_entries_kana_idx" ON "dictionary_entries" USING btree ("kana");--> statement-breakpoint
CREATE INDEX "dictionary_entries_jlpt_frequency_idx" ON "dictionary_entries" USING btree ("jlpt_level","frequency_rank");--> statement-breakpoint
CREATE INDEX "dictionary_entries_word_trgm_idx" ON "dictionary_entries" USING gin ("word" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dictionary_entries_kana_trgm_idx" ON "dictionary_entries" USING gin ("kana" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dictionary_entries_romaji_trgm_idx" ON "dictionary_entries" USING gin ("romaji" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dictionary_entries_meanings_gin_idx" ON "dictionary_entries" USING gin ("meanings");--> statement-breakpoint
CREATE INDEX "dictionary_entries_furigana_gin_idx" ON "dictionary_entries" USING gin ("furigana");--> statement-breakpoint
CREATE INDEX "dictionary_entries_pos_gin_idx" ON "dictionary_entries" USING gin ("part_of_speech");--> statement-breakpoint
CREATE INDEX "dictionary_entries_tags_gin_idx" ON "dictionary_entries" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "dictionary_entries_kanji_ids_gin_idx" ON "dictionary_entries" USING gin ("kanji_ids");--> statement-breakpoint
CREATE INDEX "dictionary_entries_fts_idx" ON "dictionary_entries" USING gin ((
        setweight(to_tsvector('simple', coalesce("word", '')), 'A') ||
        setweight(to_tsvector('simple', coalesce("kana", '') || ' ' || coalesce("romaji", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("meanings"::text, '')), 'C')
      ));--> statement-breakpoint
CREATE UNIQUE INDEX "grammar_patterns_pattern_source_uidx" ON "grammar_patterns" USING btree ("pattern","source");--> statement-breakpoint
CREATE INDEX "grammar_patterns_level_idx" ON "grammar_patterns" USING btree ("jlpt_level");--> statement-breakpoint
CREATE INDEX "grammar_patterns_pattern_trgm_idx" ON "grammar_patterns" USING gin ("pattern" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "grammar_patterns_plain_trgm_idx" ON "grammar_patterns" USING gin ("pattern_plain" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "grammar_patterns_meaning_gin_idx" ON "grammar_patterns" USING gin ("meaning");--> statement-breakpoint
CREATE INDEX "grammar_patterns_examples_gin_idx" ON "grammar_patterns" USING gin ("examples");--> statement-breakpoint
CREATE INDEX "grammar_patterns_tags_gin_idx" ON "grammar_patterns" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "grammar_patterns_fts_idx" ON "grammar_patterns" USING gin ((
        setweight(to_tsvector('simple', coalesce("pattern", '') || ' ' || coalesce("pattern_plain", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("meaning"::text, '')), 'B')
      ));--> statement-breakpoint
CREATE UNIQUE INDEX "kanji_entries_character_uidx" ON "kanji_entries" USING btree ("character");--> statement-breakpoint
CREATE UNIQUE INDEX "kanji_entries_unicode_uidx" ON "kanji_entries" USING btree ("unicode") WHERE "kanji_entries"."unicode" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "kanji_entries_jlpt_frequency_idx" ON "kanji_entries" USING btree ("jlpt_level","frequency_rank");--> statement-breakpoint
CREATE INDEX "kanji_entries_grade_idx" ON "kanji_entries" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "kanji_entries_stroke_count_idx" ON "kanji_entries" USING btree ("stroke_count");--> statement-breakpoint
CREATE INDEX "kanji_entries_meanings_gin_idx" ON "kanji_entries" USING gin ("meanings");--> statement-breakpoint
CREATE INDEX "kanji_entries_onyomi_gin_idx" ON "kanji_entries" USING gin ("onyomi");--> statement-breakpoint
CREATE INDEX "kanji_entries_kunyomi_gin_idx" ON "kanji_entries" USING gin ("kunyomi");--> statement-breakpoint
CREATE INDEX "kanji_entries_radicals_gin_idx" ON "kanji_entries" USING gin ("radicals");--> statement-breakpoint
CREATE INDEX "kanji_entries_components_gin_idx" ON "kanji_entries" USING gin ("components");--> statement-breakpoint
CREATE INDEX "kanji_entries_meaning_fts_idx" ON "kanji_entries" USING gin (to_tsvector('english', coalesce("meanings"::text, '')));--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_path_uidx" ON "media_assets" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "media_assets_related_item_idx" ON "media_assets" USING btree ("related_item_type","related_item_id");--> statement-breakpoint
CREATE INDEX "media_assets_type_created_idx" ON "media_assets" USING btree ("file_type","created_at");--> statement-breakpoint
CREATE INDEX "media_assets_voice_idx" ON "media_assets" USING btree ("voice_id");--> statement-breakpoint
CREATE INDEX "dictionary_entry_links_target_idx" ON "dictionary_entry_links" USING btree ("target_entry_id");--> statement-breakpoint
CREATE INDEX "dictionary_grammar_pattern_idx" ON "dictionary_grammar_links" USING btree ("grammar_pattern_id");--> statement-breakpoint
CREATE INDEX "dictionary_kanji_kanji_idx" ON "dictionary_kanji_links" USING btree ("kanji_entry_id");--> statement-breakpoint
CREATE INDEX "dictionary_kanji_examples_idx" ON "dictionary_kanji_links" USING btree ("kanji_entry_id","example_rank") WHERE "dictionary_kanji_links"."example_rank" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "grammar_pattern_links_target_idx" ON "grammar_pattern_links" USING btree ("target_pattern_id");--> statement-breakpoint
CREATE INDEX "kanji_entry_links_target_idx" ON "kanji_entry_links" USING btree ("target_kanji_id");--> statement-breakpoint
CREATE INDEX "question_grammar_pattern_idx" ON "question_grammar_links" USING btree ("grammar_pattern_id");--> statement-breakpoint
CREATE INDEX "question_vocabulary_dictionary_idx" ON "question_vocabulary_links" USING btree ("dictionary_entry_id");--> statement-breakpoint
CREATE INDEX "sentence_grammar_pattern_idx" ON "sentence_grammar_links" USING btree ("grammar_pattern_id");--> statement-breakpoint
CREATE INDEX "sentence_vocabulary_dictionary_idx" ON "sentence_vocabulary_links" USING btree ("dictionary_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sentences_source_source_id_uidx" ON "sentences" USING btree ("source","source_id") WHERE "sentences"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sentences_japanese_hash_idx" ON "sentences" USING hash ("japanese");--> statement-breakpoint
CREATE INDEX "sentences_level_idx" ON "sentences" USING btree ("jlpt_level");--> statement-breakpoint
CREATE INDEX "sentences_japanese_trgm_idx" ON "sentences" USING gin ("japanese" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "sentences_translations_gin_idx" ON "sentences" USING gin ("translations");--> statement-breakpoint
CREATE INDEX "sentences_grammar_ids_gin_idx" ON "sentences" USING gin ("grammar_ids");--> statement-breakpoint
CREATE INDEX "sentences_vocabulary_ids_gin_idx" ON "sentences" USING gin ("vocabulary_ids");--> statement-breakpoint
CREATE INDEX "sentences_tags_gin_idx" ON "sentences" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "sentences_fts_idx" ON "sentences" USING gin ((
        setweight(to_tsvector('simple', coalesce("japanese", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("translations"::text, '')), 'B')
      ));--> statement-breakpoint
CREATE UNIQUE INDEX "srs_cards_user_item_uidx" ON "srs_cards" USING btree ("user_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "srs_cards_due_idx" ON "srs_cards" USING btree ("user_id","next_review_at","ease_factor");--> statement-breakpoint
CREATE INDEX "srs_cards_deck_due_idx" ON "srs_cards" USING btree ("deck_id","next_review_at");--> statement-breakpoint
CREATE INDEX "srs_cards_item_idx" ON "srs_cards" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "srs_cards_last_reviewed_idx" ON "srs_cards" USING btree ("user_id","last_reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "srs_decks_user_name_uidx" ON "srs_decks" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "srs_decks_public_level_idx" ON "srs_decks" USING btree ("jlpt_level","created_at") WHERE "srs_decks"."is_public" = true;--> statement-breakpoint
CREATE INDEX "practice_tests_level_type_published_idx" ON "practice_tests" USING btree ("level","test_type","is_published");--> statement-breakpoint
CREATE INDEX "practice_tests_created_by_idx" ON "practice_tests" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "practice_tests_tags_gin_idx" ON "practice_tests" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "practice_tests_sections_gin_idx" ON "practice_tests" USING gin ("sections");--> statement-breakpoint
CREATE INDEX "questions_test_section_idx" ON "questions" USING btree ("test_id","section_type");--> statement-breakpoint
CREATE INDEX "questions_level_section_difficulty_idx" ON "questions" USING btree ("jlpt_level","section_type","difficulty");--> statement-breakpoint
CREATE INDEX "questions_active_source_idx" ON "questions" USING btree ("is_active","source");--> statement-breakpoint
CREATE INDEX "questions_options_gin_idx" ON "questions" USING gin ("options");--> statement-breakpoint
CREATE INDEX "questions_stimulus_gin_idx" ON "questions" USING gin ("stimulus");--> statement-breakpoint
CREATE INDEX "questions_vocabulary_ids_gin_idx" ON "questions" USING gin ("vocabulary_ids");--> statement-breakpoint
CREATE INDEX "questions_grammar_ids_gin_idx" ON "questions" USING gin ("grammar_ids");--> statement-breakpoint
CREATE INDEX "questions_tags_gin_idx" ON "questions" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "questions_fts_idx" ON "questions" USING gin ((
        setweight(to_tsvector('simple', coalesce("question_jp", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("question_en", '') || ' ' || coalesce("explanation_en", '')), 'B')
      ));--> statement-breakpoint
CREATE INDEX "test_sessions_user_started_idx" ON "test_sessions" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "test_sessions_test_completed_idx" ON "test_sessions" USING btree ("test_id","completed_at");--> statement-breakpoint
CREATE INDEX "test_sessions_incomplete_idx" ON "test_sessions" USING btree ("user_id","started_at") WHERE "test_sessions"."completed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "test_sessions_answers_gin_idx" ON "test_sessions" USING gin ("answers");--> statement-breakpoint
CREATE UNIQUE INDEX "user_bookmarks_user_item_collection_uidx" ON "user_bookmarks" USING btree ("user_id","item_type","item_id","collection_name");--> statement-breakpoint
CREATE INDEX "user_bookmarks_user_collection_idx" ON "user_bookmarks" USING btree ("user_id","collection_name");--> statement-breakpoint
CREATE INDEX "user_bookmarks_item_idx" ON "user_bookmarks" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_user_item_uidx" ON "user_progress" USING btree ("user_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_status_idx" ON "user_progress" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_progress_item_idx" ON "user_progress" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "user_progress_last_studied_idx" ON "user_progress" USING btree ("user_id","last_studied_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uidx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uidx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "users_study_languages_gin_idx" ON "users" USING gin ("study_languages");--> statement-breakpoint
CREATE INDEX "users_target_level_idx" ON "users" USING btree ("target_level");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "dictionary_entries_set_updated_at"
BEFORE UPDATE ON "dictionary_entries"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "kanji_entries_set_updated_at"
BEFORE UPDATE ON "kanji_entries"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "grammar_patterns_set_updated_at"
BEFORE UPDATE ON "grammar_patterns"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "sentences_set_updated_at"
BEFORE UPDATE ON "sentences"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "users_set_updated_at"
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "practice_tests_set_updated_at"
BEFORE UPDATE ON "practice_tests"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "questions_set_updated_at"
BEFORE UPDATE ON "questions"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "srs_decks_set_updated_at"
BEFORE UPDATE ON "srs_decks"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "srs_cards_set_updated_at"
BEFORE UPDATE ON "srs_cards"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."sync_srs_deck_card_count"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."deck_id" IS NOT NULL THEN
      UPDATE "srs_decks"
      SET "card_count" = "card_count" + 1
      WHERE "id" = NEW."deck_id";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."deck_id" IS NOT NULL THEN
      UPDATE "srs_decks"
      SET "card_count" = greatest("card_count" - 1, 0)
      WHERE "id" = OLD."deck_id";
    END IF;
    RETURN OLD;
  ELSIF OLD."deck_id" IS DISTINCT FROM NEW."deck_id" THEN
    IF OLD."deck_id" IS NOT NULL THEN
      UPDATE "srs_decks"
      SET "card_count" = greatest("card_count" - 1, 0)
      WHERE "id" = OLD."deck_id";
    END IF;
    IF NEW."deck_id" IS NOT NULL THEN
      UPDATE "srs_decks"
      SET "card_count" = "card_count" + 1
      WHERE "id" = NEW."deck_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "srs_cards_sync_deck_count"
AFTER INSERT OR DELETE OR UPDATE OF "deck_id" ON "srs_cards"
FOR EACH ROW EXECUTE FUNCTION "public"."sync_srs_deck_card_count"();
