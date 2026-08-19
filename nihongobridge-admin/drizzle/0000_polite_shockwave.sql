CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'content_editor', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."blog_status" AS ENUM('draft', 'published', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."etl_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'needs_changes');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" "admin_role" NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_logs_entity_type_check" CHECK (btrim("admin_audit_logs"."entity_type") <> '')
);
--> statement-breakpoint
CREATE TABLE "admin_user_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "admin_role" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"status" "blog_status" DEFAULT 'draft' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"related_content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_title_not_blank_check" CHECK (btrim("blog_posts"."title") <> ''),
	CONSTRAINT "blog_posts_slug_not_blank_check" CHECK (btrim("blog_posts"."slug") <> ''),
	CONSTRAINT "blog_posts_schedule_check" CHECK ("blog_posts"."status" <> 'scheduled' OR "blog_posts"."scheduled_for" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "content_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"confidence" double precision,
	"reviewer_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_reviews_confidence_check" CHECK ("content_reviews"."confidence" IS NULL OR "content_reviews"."confidence" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "etl_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline" text NOT NULL,
	"status" "etl_run_status" DEFAULT 'queued' NOT NULL,
	"triggered_by" uuid NOT NULL,
	"records_imported" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report_url" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "etl_pipeline_runs_counts_check" CHECK ("etl_pipeline_runs"."records_imported" >= 0 AND "etl_pipeline_runs"."error_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "etl_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline" text NOT NULL,
	"cron_expression" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etl_schedules_cron_not_blank_check" CHECK (btrim("etl_schedules"."cron_expression") <> '')
);
--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_created_idx" ON "admin_audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_entity_idx" ON "admin_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_user_roles_role_idx" ON "admin_user_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uidx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_status_schedule_idx" ON "blog_posts" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "blog_posts_tags_gin_idx" ON "blog_posts" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "content_reviews_entity_uidx" ON "content_reviews" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "content_reviews_status_updated_idx" ON "content_reviews" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "etl_pipeline_runs_pipeline_started_idx" ON "etl_pipeline_runs" USING btree ("pipeline","started_at");--> statement-breakpoint
CREATE INDEX "etl_pipeline_runs_status_idx" ON "etl_pipeline_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "etl_schedules_pipeline_uidx" ON "etl_schedules" USING btree ("pipeline");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "admin_user_roles_set_updated_at" BEFORE UPDATE ON "admin_user_roles"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "content_reviews_set_updated_at" BEFORE UPDATE ON "content_reviews"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "etl_schedules_set_updated_at" BEFORE UPDATE ON "etl_schedules"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "blog_posts_set_updated_at" BEFORE UPDATE ON "blog_posts"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
