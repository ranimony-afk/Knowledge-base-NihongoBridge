import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { mediaFileTypeEnum } from "./enums.js";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    fileType: mediaFileTypeEnum("file_type").notNull(),
    mimeType: text("mime_type").notNull(),
    url: text("url").notNull(),
    storagePath: text("storage_path").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationMs: integer("duration_ms"),
    relatedItemType: text("related_item_type"),
    relatedItemId: uuid("related_item_id"),
    language: text("language").notNull().default("ja"),
    voiceId: text("voice_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_storage_path_uidx").on(table.storagePath),
    index("media_assets_related_item_idx").on(
      table.relatedItemType,
      table.relatedItemId,
    ),
    index("media_assets_type_created_idx").on(table.fileType, table.createdAt),
    index("media_assets_voice_idx").on(table.voiceId),
    check("media_assets_filename_not_blank_check", sql`btrim(${table.filename}) <> ''`),
    check("media_assets_mime_type_not_blank_check", sql`btrim(${table.mimeType}) <> ''`),
    check("media_assets_url_not_blank_check", sql`btrim(${table.url}) <> ''`),
    check(
      "media_assets_storage_path_not_blank_check",
      sql`btrim(${table.storagePath}) <> ''`,
    ),
    check("media_assets_size_bytes_check", sql`${table.sizeBytes} >= 0`),
    check(
      "media_assets_duration_check",
      sql`${table.durationMs} IS NULL OR ${table.durationMs} >= 0`,
    ),
    check(
      "media_assets_related_pair_check",
      sql`(${table.relatedItemType} IS NULL) = (${table.relatedItemId} IS NULL)`,
    ),
    check("media_assets_language_not_blank_check", sql`btrim(${table.language}) <> ''`),
  ],
);
