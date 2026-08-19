import type { ZodType } from "zod";

import { DICTIONARY_TOOL, lookupDictionary } from "@/lib/dictionary-tool";
import type { TutorMessage } from "@/types/tutor";

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export class AnthropicError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicJsonResponse {
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  error?: { message?: string };
}

export interface TutorCompletionResult {
  text: string;
  model: string;
  toolsUsed: number;
}

interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}

interface MutableTextBlock {
  type: "text";
  text: string;
}

interface MutableToolBlock {
  type: "tool_use";
  id: string;
  name: string;
  inputJson: string;
  initialInput: unknown;
}

type MutableBlock = MutableTextBlock | MutableToolBlock;

export function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

function endpoint(): string {
  return process.env.ANTHROPIC_API_URL?.trim() || "https://api.anthropic.com/v1/messages";
}

function timeoutMilliseconds(): number {
  const configured = Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "45000", 10);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : 45_000;
}

async function callAnthropic(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AnthropicError("AI tutor is not configured", 503);

  const signals = [AbortSignal.timeout(timeoutMilliseconds())];
  if (signal) signals.push(signal);
  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.any(signals),
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted) throw new AnthropicError("AI request was cancelled", 499);
    throw new AnthropicError(
      error instanceof Error ? `Anthropic request failed: ${error.message}` : "Anthropic request failed",
      502,
    );
  }

  if (!response.ok) {
    let message = `Anthropic returned HTTP ${response.status}`;
    try {
      const body = await response.json() as AnthropicJsonResponse;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Keep the status-only message when Anthropic does not return JSON.
    }
    const status = response.status === 429 ? 503 : 502;
    throw new AnthropicError(message, status);
  }
  return response;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const firstObject = unfenced.indexOf("{");
    const lastObject = unfenced.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(unfenced.slice(firstObject, lastObject + 1));
    }
    throw new AnthropicError("Anthropic returned malformed JSON");
  }
}

export async function generateStructured<T>(options: {
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{ data: T; model: string }> {
  const model = anthropicModel();
  const payload: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 4_096,
    temperature: 0.2,
    system: options.system,
    messages: [{ role: "user", content: options.user }],
  };
  const response = await callAnthropic(payload, options.signal);
  const body = await response.json() as AnthropicJsonResponse;
  const text = body.content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
  if (!text) throw new AnthropicError("Anthropic returned no text content");
  const parsed = options.schema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new AnthropicError("Anthropic returned a response that failed validation");
  }
  return { data: parsed.data, model: body.model ?? model };
}

function normalizeMessages(history: TutorMessage[], message: string): AnthropicMessage[] {
  const recent = history.slice(-10);
  const combined: AnthropicMessage[] = [];
  for (const item of [...recent, { role: "user" as const, content: message }]) {
    if (!combined.length && item.role === "assistant") continue;
    const previous = combined.at(-1);
    if (previous?.role === item.role && typeof previous.content === "string") {
      previous.content = `${previous.content}\n\n${item.content}`;
    } else {
      combined.push({ role: item.role, content: item.content });
    }
  }
  return combined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function initializeBlock(data: Record<string, unknown>): { index: number; block: MutableBlock } | null {
  const index = readNumber(data.index);
  const raw = data.content_block;
  if (index === undefined || !raw || typeof raw !== "object") return null;
  const content = raw as Record<string, unknown>;
  if (content.type === "text") {
    return { index, block: { type: "text", text: readString(content.text) ?? "" } };
  }
  if (
    content.type === "tool_use" &&
    readString(content.id) &&
    readString(content.name)
  ) {
    return {
      index,
      block: {
        type: "tool_use",
        id: readString(content.id) as string,
        name: readString(content.name) as string,
        inputJson: "",
        initialInput: content.input ?? {},
      },
    };
  }
  return null;
}

function applyDelta(
  data: Record<string, unknown>,
  blocks: Map<number, MutableBlock>,
): string {
  const index = readNumber(data.index);
  const raw = data.delta;
  if (index === undefined || !raw || typeof raw !== "object") return "";
  const block = blocks.get(index);
  if (!block) return "";
  const delta = raw as Record<string, unknown>;
  if (block.type === "text" && delta.type === "text_delta") {
    const text = readString(delta.text) ?? "";
    block.text += text;
    return text;
  }
  if (block.type === "tool_use" && delta.type === "input_json_delta") {
    block.inputJson += readString(delta.partial_json) ?? "";
  }
  return "";
}

function finalizedBlocks(blocks: Map<number, MutableBlock>): AnthropicContentBlock[] {
  return [...blocks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, block]) => {
      if (block.type === "text") return { type: "text", text: block.text };
      let input = block.initialInput;
      if (block.inputJson.trim()) {
        try {
          input = JSON.parse(block.inputJson);
        } catch {
          input = {};
        }
      }
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input,
      };
    });
}

async function* parseEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseFrame(frame);
        if (event) yield event;
        boundary = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    const finalEvent = parseFrame(buffer);
    if (finalEvent) yield finalEvent;
  } finally {
    reader.releaseLock();
  }
}

function parseFrame(frame: string): StreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length || dataLines.join("\n") === "[DONE]") return null;
  try {
    const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
    return { event, data };
  } catch {
    throw new AnthropicError("Anthropic returned a malformed stream event");
  }
}

async function toolResults(blocks: AnthropicContentBlock[]): Promise<AnthropicToolResultBlock[]> {
  const uses = blocks.filter((block): block is AnthropicToolUseBlock => block.type === "tool_use");
  return Promise.all(
    uses.map(async (use) => {
      const content = use.name === DICTIONARY_TOOL.name
        ? await lookupDictionary(use.input)
        : JSON.stringify({ error: `Unsupported tool: ${use.name}` });
      return {
        type: "tool_result" as const,
        tool_use_id: use.id,
        content,
        ...(content.includes('"error"') ? { is_error: true } : {}),
      };
    }),
  );
}

export async function* streamTutorCompletion(options: {
  system: string;
  history: TutorMessage[];
  message: string;
  signal?: AbortSignal;
}): AsyncGenerator<string, TutorCompletionResult, void> {
  const model = anthropicModel();
  const messages = normalizeMessages(options.history, options.message);
  let fullText = "";
  let toolsUsed = 0;

  for (let round = 0; round < 3; round += 1) {
    const response = await callAnthropic({
      model,
      max_tokens: 1_500,
      temperature: 0.35,
      system: options.system,
      tools: [DICTIONARY_TOOL],
      tool_choice: { type: "auto" },
      messages,
      stream: true,
    }, options.signal);
    if (!response.body) throw new AnthropicError("Anthropic returned an empty stream");

    const blocks = new Map<number, MutableBlock>();
    let stopReason: string | undefined;
    let responseModel = model;
    for await (const event of parseEventStream(response.body)) {
      if (event.event === "error") {
        const error = event.data.error;
        const message = error && typeof error === "object"
          ? readString((error as Record<string, unknown>).message)
          : undefined;
        throw new AnthropicError(message ?? "Anthropic stream failed");
      }
      if (event.event === "message_start") {
        const rawMessage = event.data.message;
        if (rawMessage && typeof rawMessage === "object") {
          responseModel = readString((rawMessage as Record<string, unknown>).model) ?? responseModel;
        }
      }
      if (event.event === "content_block_start") {
        const initialized = initializeBlock(event.data);
        if (initialized) blocks.set(initialized.index, initialized.block);
      }
      if (event.event === "content_block_delta") {
        const text = applyDelta(event.data, blocks);
        if (text) {
          fullText += text;
          yield text;
        }
      }
      if (event.event === "message_delta") {
        const rawDelta = event.data.delta;
        if (rawDelta && typeof rawDelta === "object") {
          stopReason = readString((rawDelta as Record<string, unknown>).stop_reason);
        }
      }
    }

    const completed = finalizedBlocks(blocks);
    if (stopReason !== "tool_use") {
      if (!fullText.trim()) throw new AnthropicError("Anthropic returned no tutor response");
      return { text: fullText, model: responseModel, toolsUsed };
    }

    const results = await toolResults(completed);
    if (!results.length) throw new AnthropicError("Anthropic requested an invalid tool call");
    toolsUsed += results.length;
    messages.push({ role: "assistant", content: completed });
    messages.push({ role: "user", content: results });
  }

  throw new AnthropicError("Anthropic exceeded the maximum tool-call rounds");
}
