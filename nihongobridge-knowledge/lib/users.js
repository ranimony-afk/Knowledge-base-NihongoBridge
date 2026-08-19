import { sql } from "drizzle-orm";
import { check, date, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
import { contentItemTypeEnum, jlptLevelEnum, progressStatusEnum, } from "./enums.js";
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    targetLevel: jlptLevelEnum("target_level").notNull().default("N5"),
    currentLevel: jlptLevelEnum("current_level").notNull().default("NONE"),
    studyLanguages: text("study_languages")
        .array()
        .notNull()
        .default(sql `ARRAY['en']::text[]`),
    streakDays: integer("streak_days").notNull().default(0),
    lastStudyDate: date("last_study_date", { mode: "date" }),
    xpTotal: integer("xp_total").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("users_email_lower_uidx").on(sql `lower(${table.email})`),
    uniqueIndex("users_username_lower_uidx").on(sql `lower(${table.username})`),
    index("users_study_languages_gin_idx").using("gin", table.studyLanguages),
    index("users_target_level_idx").on(table.targetLevel),
    check("users_email_shape_check", sql `btrim(${table.email}) <> '' AND position('@' in ${table.email}) > 1`),
    check("users_username_not_blank_check", sql `btrim(${table.username}) <> ''`),
    check("users_streak_days_check", sql `${table.streakDays} >= 0`),
    check("users_xp_total_check", sql `${table.xpTotal} >= 0`),
    check("users_study_languages_check", sql `cardinality(${table.studyLanguages}) > 0 AND ${table.studyLanguages} <@ ARRAY['en','ta','ml','hi']::text[]`),
]);
export const userProgress = pgTable("user_progress", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    itemType: contentItemTypeEnum("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    status: progressStatusEnum("status").notNull().default("not_started"),
    accuracy: doublePrecision("accuracy").notNull().default(0),
    studyCount: integer("study_count").notNull().default(0),
    lastStudiedAt: timestamp("last_studied_at", {
        withTimezone: true,
        mode: "date",
    }),
    notes: text("notes"),
}, (table) => [
    uniqueIndex("user_progress_user_item_uidx").on(table.userId, table.itemType, table.itemId),
    index("user_progress_user_status_idx").on(table.userId, table.status),
    index("user_progress_item_idx").on(table.itemType, table.itemId),
    index("user_progress_last_studied_idx").on(table.userId, table.lastStudiedAt),
    check("user_progress_accuracy_check", sql `${table.accuracy} BETWEEN 0 AND 1`),
    check("user_progress_study_count_check", sql `${table.studyCount} >= 0`),
]);
export const userBookmarks = pgTable("user_bookmarks", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    itemType: contentItemTypeEnum("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    collectionName: text("collection_name").notNull().default("Default"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .defaultNow(),
}, (table) => [
    uniqueIndex("user_bookmarks_user_item_collection_uidx").on(table.userId, table.itemType, table.itemId, table.collectionName),
    index("user_bookmarks_user_collection_idx").on(table.userId, table.collectionName),
    index("user_bookmarks_item_idx").on(table.itemType, table.itemId),
    check("user_bookmarks_collection_not_blank_check", sql `btrim(${table.collectionName}) <> ''`),
]);
//# sourceMappingURL=users.js.map