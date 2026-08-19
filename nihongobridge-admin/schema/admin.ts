import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const adminRoleEnum = pgEnum("admin_role", [
  "super_admin",
  "content_editor",
  "reviewer",
]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);
export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
  "needs_changes",
]);
export const etlRunStatusEnum = pgEnum("etl_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const blogStatusEnum = pgEnum("blog_status", [
  "draft",
  "published",
  "scheduled",
]);

export interface AuditDiff {
  before?: unknown;
  after?: unknown;
  changed?: string[] | undefined;
}

export interface TiptapDocument {
  type: "doc";
  content?: unknown[];
}

export interface RelatedContentLink {
  type: "word" | "kanji" | "grammar" | "sentence";
  id: string;
  label: string;
}

export const adminUserRoles = pgTable(
  "admin_user_roles",
  {
    userId: uuid("user_id").primaryKey(),
    role: adminRoleEnum("role").notNull(),
    grantedBy: uuid("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("admin_user_roles_role_idx").on(table.role)],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").notNull(),
    actorRole: adminRoleEnum("actor_role").notNull(),
    action: auditActionEnum("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    diff: jsonb("diff").$type<AuditDiff>().notNull().default(sql`'{}'::jsonb`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_audit_logs_actor_created_idx").on(table.actorId, table.createdAt),
    index("admin_audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("admin_audit_logs_created_idx").on(table.createdAt),
    check("admin_audit_logs_entity_type_check", sql`btrim(${table.entityType}) <> ''`),
  ],
);

export const contentReviews = pgTable(
  "content_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    status: reviewStatusEnum("status").notNull().default("pending"),
    confidence: doublePrecision("confidence"),
    reviewerId: uuid("reviewer_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("content_reviews_entity_uidx").on(table.entityType, table.entityId),
    index("content_reviews_status_updated_idx").on(table.status, table.updatedAt),
    check(
      "content_reviews_confidence_check",
      sql`${table.confidence} IS NULL OR ${table.confidence} BETWEEN 0 AND 1`,
    ),
  ],
);

export const etlPipelineRuns = pgTable(
  "etl_pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipeline: text("pipeline").notNull(),
    status: etlRunStatusEnum("status").notNull().default("queued"),
    triggeredBy: uuid("triggered_by").notNull(),
    recordsImported: integer("records_imported").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    logs: jsonb("logs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    reportUrl: text("report_url"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("etl_pipeline_runs_pipeline_started_idx").on(table.pipeline, table.startedAt),
    index("etl_pipeline_runs_status_idx").on(table.status),
    check("etl_pipeline_runs_counts_check", sql`${table.recordsImported} >= 0 AND ${table.errorCount} >= 0`),
  ],
);

export const etlSchedules = pgTable(
  "etl_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipeline: text("pipeline").notNull(),
    cronExpression: text("cron_expression").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: uuid("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("etl_schedules_pipeline_uidx").on(table.pipeline),
    check("etl_schedules_cron_not_blank_check", sql`btrim(${table.cronExpression}) <> ''`),
  ],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    content: jsonb("content")
      .$type<TiptapDocument>()
      .notNull()
      .default(sql`'{"type":"doc","content":[]}'::jsonb`),
    status: blogStatusEnum("status").notNull().default("draft"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    categories: text("categories").array().notNull().default(sql`ARRAY[]::text[]`),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    relatedContent: jsonb("related_content")
      .$type<RelatedContentLink[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    authorId: uuid("author_id").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("blog_posts_slug_uidx").on(table.slug),
    index("blog_posts_status_schedule_idx").on(table.status, table.scheduledFor),
    index("blog_posts_tags_gin_idx").using("gin", table.tags),
    check("blog_posts_title_not_blank_check", sql`btrim(${table.title}) <> ''`),
    check("blog_posts_slug_not_blank_check", sql`btrim(${table.slug}) <> ''`),
    check(
      "blog_posts_schedule_check",
      sql`${table.status} <> 'scheduled' OR ${table.scheduledFor} IS NOT NULL`,
    ),
  ],
);

export type AdminUserRole = typeof adminUserRoles.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type ContentReview = typeof contentReviews.$inferSelect;
export type EtlPipelineRun = typeof etlPipelineRuns.$inferSelect;
export type EtlSchedule = typeof etlSchedules.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
