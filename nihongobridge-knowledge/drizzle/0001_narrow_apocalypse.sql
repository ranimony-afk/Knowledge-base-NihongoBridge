CREATE TABLE "srs_review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"confidence" "srs_confidence" NOT NULL,
	"was_correct" boolean NOT NULL,
	"time_taken_ms" integer NOT NULL,
	"previous_interval_days" integer NOT NULL,
	"next_interval_days" integer NOT NULL,
	"previous_ease_factor" double precision NOT NULL,
	"next_ease_factor" double precision NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "srs_review_logs_time_taken_check" CHECK ("srs_review_logs"."time_taken_ms" >= 0),
	CONSTRAINT "srs_review_logs_interval_check" CHECK ("srs_review_logs"."previous_interval_days" >= 1 AND "srs_review_logs"."next_interval_days" >= 1),
	CONSTRAINT "srs_review_logs_ease_check" CHECK ("srs_review_logs"."previous_ease_factor" BETWEEN 1.3 AND 2.5 AND "srs_review_logs"."next_ease_factor" BETWEEN 1.3 AND 2.5)
);
--> statement-breakpoint
ALTER TABLE "srs_review_logs" ADD CONSTRAINT "srs_review_logs_card_id_srs_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."srs_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_review_logs" ADD CONSTRAINT "srs_review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "srs_review_logs_user_reviewed_idx" ON "srs_review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "srs_review_logs_card_reviewed_idx" ON "srs_review_logs" USING btree ("card_id","reviewed_at");