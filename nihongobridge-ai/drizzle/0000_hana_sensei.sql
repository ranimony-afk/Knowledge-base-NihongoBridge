CREATE TABLE "ai_explanations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "cache_key" text NOT NULL,
  "grammar_pattern_id" uuid,
  "user_id" uuid,
  "language" text DEFAULT 'en' NOT NULL,
  "user_level" text NOT NULL,
  "request_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "response" jsonb NOT NULL,
  "response_text" text,
  "model" text NOT NULL,
  "prompt_version" text NOT NULL,
  "hit_count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_explanations_kind_check" CHECK ("kind" IN ('tutor_chat', 'grammar', 'translation')),
  CONSTRAINT "ai_explanations_cache_key_not_blank_check" CHECK (btrim("cache_key") <> ''),
  CONSTRAINT "ai_explanations_language_check" CHECK ("language" IN ('en','ta','ml','hi','ja')),
  CONSTRAINT "ai_explanations_level_check" CHECK ("user_level" IN ('N5','N4','N3','N2','N1','NONE')),
  CONSTRAINT "ai_explanations_model_not_blank_check" CHECK (btrim("model") <> ''),
  CONSTRAINT "ai_explanations_prompt_version_not_blank_check" CHECK (btrim("prompt_version") <> ''),
  CONSTRAINT "ai_explanations_hit_count_check" CHECK ("hit_count" >= 0),
  CONSTRAINT "ai_explanations_request_context_object_check" CHECK (jsonb_typeof("request_context") = 'object'),
  CONSTRAINT "ai_explanations_response_object_check" CHECK (jsonb_typeof("response") = 'object')
);
--> statement-breakpoint
ALTER TABLE "ai_explanations" ADD CONSTRAINT "ai_explanations_grammar_pattern_id_grammar_patterns_id_fk" FOREIGN KEY ("grammar_pattern_id") REFERENCES "public"."grammar_patterns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_explanations" ADD CONSTRAINT "ai_explanations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_explanations_cache_key_uidx" ON "ai_explanations" USING btree ("cache_key");
--> statement-breakpoint
CREATE INDEX "ai_explanations_grammar_level_language_idx" ON "ai_explanations" USING btree ("grammar_pattern_id","user_level","language");
--> statement-breakpoint
CREATE INDEX "ai_explanations_user_created_idx" ON "ai_explanations" USING btree ("user_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "ai_explanations_kind_expires_idx" ON "ai_explanations" USING btree ("kind","expires_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_ai_explanations_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ai_explanations_set_updated_at
BEFORE UPDATE ON "ai_explanations"
FOR EACH ROW EXECUTE FUNCTION set_ai_explanations_updated_at();
