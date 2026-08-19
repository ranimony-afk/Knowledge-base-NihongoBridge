import { EdgeTTS } from "@andresaya/edge-tts";
import { randomUUID } from "node:crypto";

import { uploadAudio } from "@/lib/storage";
import type { DialogueLine, VoiceConfig } from "@/types/test";

const DEFAULT_FEMALE = "ja-JP-NanamiNeural";
const DEFAULT_MALE = "ja-JP-KeitaNeural";
const MAX_REQUESTS_PER_SECOND = 10;

let nextRequestAt = 0;
let rateQueue = Promise.resolve();

async function rateLimitTts(): Promise<void> {
  const previous = rateQueue;
  let release: () => void = () => {};
  rateQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const now = Date.now();
  const delay = Math.max(0, nextRequestAt - now);
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  nextRequestAt = Date.now() + 1_000 / MAX_REQUESTS_PER_SECOND;
  release();
}

export async function generateListeningAudio(
  script: DialogueLine[],
  config: VoiceConfig,
): Promise<{ audioUrl: string; objectKey: string }> {
  const female = config.female_voice ?? process.env.EDGE_TTS_FEMALE_VOICE ?? DEFAULT_FEMALE;
  const male = config.male_voice ?? process.env.EDGE_TTS_MALE_VOICE ?? DEFAULT_MALE;
  const rate = config.rate ?? process.env.EDGE_TTS_RATE ?? "+0%";
  const volume = config.volume ?? process.env.EDGE_TTS_VOLUME ?? "+0%";
  const chunks: Buffer[] = [];

  for (let index = 0; index < script.length; index += 1) {
    const line = script[index];
    if (!line) continue;
    const voice = index % 2 === 0 ? female : male;
    chunks.push(await synthesizeWithRetry(line.text, voice, rate, volume));
  }
  const audio = Buffer.concat(chunks);
  if (!audio.length) throw new Error("Edge TTS returned no audio");
  const objectKey = `generated/${randomUUID()}.mp3`;
  const audioUrl = await uploadAudio(objectKey, audio);
  return { audioUrl, objectKey };
}

async function synthesizeWithRetry(
  text: string,
  voice: string,
  rate: string,
  volume: string,
): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await rateLimitTts();
      const tts = new EdgeTTS();
      await tts.synthesize(text, voice, { rate, volume });
      const output = tts.toBuffer();
      if (!output.length) throw new Error("Edge TTS returned an empty clip");
      return output;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }
  throw new Error("Edge TTS generation failed", { cause: lastError });
}

export function resetTtsRateLimiter(): void {
  nextRequestAt = 0;
  rateQueue = Promise.resolve();
}
