import { z } from "zod";

export const jlptLevelSchema = z.enum(["N5", "N4", "N3", "N2", "N1"]);

const page = z.coerce.number().int().min(1).default(1);
const limit20 = z.coerce.number().int().min(1).max(100).default(20);

export const dictionarySearchSchema = z.object({
  q: z.string().trim().min(1).max(128),
  level: jlptLevelSchema.optional(),
  pos: z.string().trim().min(1).max(64).optional(),
  has_audio: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page,
  limit: limit20,
});

export const autocompleteSchema = z.object({
  q: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const randomDictionarySchema = z.object({
  level: jlptLevelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(1),
});

export const dictionaryBulkSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100).transform((ids) => [...new Set(ids)]),
});

export const uuidParameterSchema = z.uuid();

export const kanjiCharacterSchema = z
  .string()
  .trim()
  .refine((value) => Array.from(value).length === 1, "Expected one Unicode character");

export const kanjiSearchSchema = z
  .object({
    q: z.string().trim().min(1).max(64).optional(),
    level: jlptLevelSchema.optional(),
    grade: z.coerce.number().int().min(1).max(9).optional(),
    stroke_min: z.coerce.number().int().min(1).max(64).optional(),
    stroke_max: z.coerce.number().int().min(1).max(64).optional(),
    radical: z.string().trim().min(1).max(8).optional(),
    page,
    limit: limit20,
  })
  .refine(
    (value) =>
      value.stroke_min === undefined ||
      value.stroke_max === undefined ||
      value.stroke_min <= value.stroke_max,
    { message: "stroke_min must be less than or equal to stroke_max", path: ["stroke_min"] },
  )
  .refine(
    (value) =>
      Boolean(
        value.q ||
          value.level ||
          value.grade ||
          value.stroke_min ||
          value.stroke_max ||
          value.radical,
      ),
    { message: "At least one search filter is required" },
  );

export const radicalParameterSchema = z.string().trim().min(1).max(8);

export const radicalListSchema = z.object({
  page,
  limit: limit20,
});

export const levelListSchema = z.object({
  page,
  limit: limit20,
});

export const kanjiQuizSchema = z.object({
  quiz_type: z.enum(["reading", "meaning", "all"]).default("all"),
});

export function searchParamsObject(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}
