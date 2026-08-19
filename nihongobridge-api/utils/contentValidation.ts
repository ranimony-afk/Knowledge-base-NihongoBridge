import { z } from "zod";

import { jlptLevelSchema } from "@/utils/validation";

export const contentItemTypeSchema = z.enum(["word", "kanji", "grammar", "sentence"]);

export const srsDueSchema = z.object({
  user_id: z.uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  deck_id: z.uuid().optional(),
});

export const srsReviewSchema = z.object({
  card_id: z.uuid(),
  confidence: z.enum(["again", "hard", "good", "easy"]),
  time_taken_ms: z.number().int().min(0).max(3_600_000),
});

export const srsAddSchema = z.object({
  user_id: z.uuid(),
  item_type: contentItemTypeSchema,
  item_id: z.uuid(),
  deck_id: z.uuid().optional(),
});

export const grammarSearchSchema = z.object({
  q: z.string().trim().min(1).max(128),
  level: jlptLevelSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const grammarListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const bookmarkBodySchema = z.object({
  item_type: contentItemTypeSchema,
  item_id: z.uuid(),
  collection_name: z.string().trim().min(1).max(100).default("Default"),
});

export const bookmarkListSchema = z.object({
  item_type: contentItemTypeSchema.optional(),
  collection_name: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const globalSearchTypeSchema = z.enum(["word", "kanji", "grammar", "sentence"]);

export const globalSearchSchema = z.object({
  q: z.string().trim().min(1).max(128),
  types: z
    .string()
    .default("word,kanji,grammar,sentence")
    .transform((value, context) => {
      const parsed = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
      const result = z.array(globalSearchTypeSchema).min(1).safeParse(parsed);
      if (!result.success) {
        context.addIssue({ code: "custom", message: "types contains an unsupported content type" });
        return z.NEVER;
      }
      return result.data;
    }),
  level: jlptLevelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
