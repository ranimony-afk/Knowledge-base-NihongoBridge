import { z } from "zod";

const concreteLevelSchema = z.enum(["N5", "N4", "N3", "N2", "N1"]);
const tutorLanguageSchema = z.enum(["en", "ta", "ml", "hi"]);
export const translationLanguageSchema = z.enum(["ja", "en", "ta", "ml", "hi"]);
export const questionSectionSchema = z.enum(["vocabulary", "grammar", "reading", "listening"]);

export const tutorContextSchema = z.object({
  current_level: concreteLevelSchema,
  recent_mistakes: z.array(z.string().trim().min(1).max(100)).max(20),
  current_topic: z.string().trim().min(1).max(200).optional(),
  language_preference: tutorLanguageSchema,
});

export const tutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6_000),
});

export const tutorChatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(4_000),
    context: tutorContextSchema,
    conversation_history: z.array(tutorMessageSchema).max(10),
  })
  .superRefine((value, context) => {
    const totalCharacters = value.conversation_history.reduce(
      (total, message) => total + message.content.length,
      value.message.length,
    );
    if (totalCharacters > 24_000) {
      context.addIssue({
        code: "custom",
        path: ["conversation_history"],
        message: "Message and conversation history may not exceed 24,000 characters",
      });
    }
  });

export const grammarExplainRequestSchema = z.object({
  pattern_id: z.string().uuid(),
  user_level: concreteLevelSchema,
  example_sentence: z.string().trim().min(1).max(1_000).optional(),
});

export const translationRequestSchema = z.object({
  text: z.string().trim().min(1).max(5_000),
  target_lang: translationLanguageSchema,
  include_breakdown: z.boolean(),
});

export const generateQuestionsRequestSchema = z.object({
  level: concreteLevelSchema,
  topic: z.string().trim().min(1).max(200),
  section: questionSectionSchema,
  count: z.number().int().min(1).max(50),
});

export const grammarExplanationSchema = z.object({
  explanation_jp: z.string().trim().min(1).max(4_000),
  explanation_en: z.string().trim().min(1).max(4_000),
  original_examples: z
    .array(
      z.object({
        japanese: z.string().trim().min(1).max(500),
        reading: z.string().trim().min(1).max(500),
        translation_en: z.string().trim().min(1).max(1_000),
      }),
    )
    .length(3),
  common_mistakes: z.array(z.string().trim().min(1).max(1_000)).min(1).max(8),
});

export const translationResultSchema = z.object({
  translation: z.string().trim().min(1).max(10_000),
  source_lang: translationLanguageSchema,
  target_lang: translationLanguageSchema,
  breakdown: z
    .array(
      z.object({
        japanese: z.string().trim().min(1).max(200),
        reading: z.string().trim().min(1).max(200).nullable(),
        meaning: z.string().trim().min(1).max(1_000),
        grammar_note: z.string().trim().min(1).max(1_000).nullable(),
      }),
    )
    .max(100)
    .nullable(),
});

const generatedOptionSchema = z.object({
  id: z.string().trim().min(1).max(20),
  text_jp: z.string().trim().max(1_000),
  text_en: z.string().trim().max(1_000),
}).refine((option) => option.text_jp.length > 0 || option.text_en.length > 0, {
  message: "Each option must include Japanese or English text",
});

const generatedStimulusSchema = z
  .object({
    kind: z.enum(["passage", "audio", "image", "dialogue"]).optional(),
    passage: z.string().trim().max(5_000).optional(),
    transcript: z
      .array(
        z.object({
          speaker: z.string().trim().min(1).max(100),
          text: z.string().trim().min(1).max(2_000),
          reading: z.string().trim().max(2_000).optional(),
        }),
      )
      .max(20)
      .optional(),
  })
  .nullable();

export const generatedQuestionSchema = z
  .object({
    question_jp: z.string().trim().max(2_000).nullable(),
    question_en: z.string().trim().max(2_000).nullable(),
    stimulus: generatedStimulusSchema,
    options: z.array(generatedOptionSchema).min(2).max(8),
    correct_answer: z.string().trim().min(1).max(20),
    explanation_jp: z.string().trim().min(1).max(3_000),
    explanation_en: z.string().trim().min(1).max(3_000),
    difficulty: z.number().int().min(1).max(5),
    time_limit_seconds: z.number().int().min(1).max(900).nullable(),
    tags: z.array(z.string().trim().min(1).max(80)).max(20),
    grounding_vocabulary_ids: z.array(z.string().uuid()).max(20),
    grounding_grammar_ids: z.array(z.string().uuid()).max(20),
  })
  .refine(
    (question) => Boolean(question.question_jp?.length || question.question_en?.length),
    { message: "A generated question needs Japanese or English question text" },
  )
  .refine(
    (question) => question.options.some((option) => option.id === question.correct_answer),
    { message: "correct_answer must match an option id" },
  );

export const generatedQuestionBatchSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(10),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GenerateQuestionsInput = z.infer<typeof generateQuestionsRequestSchema>;
