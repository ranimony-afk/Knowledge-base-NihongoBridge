import { z } from "zod";

import { jlptLevelSchema } from "@/utils/validation";

export const testSectionSchema = z.enum(["vocabulary", "grammar", "reading", "listening"]);

export const startTestSchema = z
  .object({
    level: jlptLevelSchema,
    test_type: z.enum(["full_mock", "section_drill", "mock_full", "section_only"]),
    section: testSectionSchema.optional(),
    user_id: z.uuid(),
  })
  .refine(
    (value) =>
      !["section_drill", "section_only"].includes(value.test_type) || value.section !== undefined,
    { message: "section is required for a section drill", path: ["section"] },
  );

export const sessionIdSchema = z.uuid();
export const testIdSchema = z.uuid();
export const userIdSchema = z.uuid();

export const answerTestSchema = z.object({
  question_id: z.uuid(),
  selected: z.string().trim().min(1).max(64),
  time_taken_ms: z.number().int().min(0).max(3_600_000),
});

export const historySchema = z.object({
  user_id: z.uuid(),
  level: jlptLevelSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const testQuestionsSchema = z.object({
  section: testSectionSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const percentage = z.string().regex(/^[+-]\d+%$/);
const voiceName = z
  .string()
  .trim()
  .regex(/^ja-JP-[A-Za-z]+Neural$/, "Only Japanese neural voices are allowed");

export const listeningGenerateSchema = z
  .object({
    script: z
      .array(
        z.object({
          speaker: z.string().trim().min(1).max(64).optional(),
          text: z.string().trim().min(1).max(500),
        }),
      )
      .min(1)
      .max(50),
    voice_config: z
      .object({
        female_voice: voiceName.optional(),
        male_voice: voiceName.optional(),
        rate: percentage.optional(),
        volume: percentage.optional(),
      })
      .default({}),
  })
  .refine((value) => value.script.reduce((sum, line) => sum + line.text.length, 0) <= 5_000, {
    message: "Combined script length cannot exceed 5000 characters",
    path: ["script"],
  });
