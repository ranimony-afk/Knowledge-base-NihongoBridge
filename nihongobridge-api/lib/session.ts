import { randomUUID } from "node:crypto";

import {
  ensureRedisConnection,
  getRedisClient,
} from "@/middleware/cache";
import type {
  SessionAnswer,
  SessionStatusResponse,
  TestSessionState,
} from "@/types/test";

interface MemorySession {
  state: TestSessionState;
  expiresAt: number;
}

const memorySessions = new Map<string, MemorySession>();
const memoryLocks = new Map<string, Promise<void>>();
const completionLocks = new Set<string>();
const ACTIVE_GRACE_SECONDS = 86_400;
const COMPLETED_TTL_SECONDS = 86_400;

export class SessionNotFoundError extends Error {}
export class SessionConflictError extends Error {}

function sessionKey(sessionId: string): string {
  return `${process.env.SESSION_KEY_PREFIX ?? "tests:session"}:${sessionId}`;
}

function ttlForState(state: TestSessionState): number {
  if (state.status === "completed") return COMPLETED_TTL_SECONDS;
  const remaining = Math.ceil((Date.parse(state.deadline_at) - Date.now()) / 1_000);
  return Math.max(300, remaining + ACTIVE_GRACE_SECONDS);
}

function requireRedis(): boolean {
  return process.env.SESSION_REQUIRE_REDIS === "true";
}

async function redisOrNull() {
  const client = getRedisClient();
  if (!client) {
    if (requireRedis()) throw new Error("Redis is required for test sessions");
    return null;
  }
  try {
    await ensureRedisConnection(client);
    return client;
  } catch (error) {
    if (requireRedis()) throw error;
    return null;
  }
}

export async function createSession(state: TestSessionState): Promise<void> {
  const client = await redisOrNull();
  const ttl = ttlForState(state);
  if (client) {
    const created = await client.set(sessionKey(state.session_id), JSON.stringify(state), "EX", ttl, "NX");
    if (created !== "OK") throw new SessionConflictError("Session already exists");
    return;
  }
  if (memorySessions.has(state.session_id)) {
    throw new SessionConflictError("Session already exists");
  }
  memorySessions.set(state.session_id, {
    state: structuredClone(state),
    expiresAt: Date.now() + ttl * 1_000,
  });
}

export async function getSession(sessionId: string): Promise<TestSessionState | null> {
  const client = await redisOrNull();
  if (client) {
    const value = await client.get(sessionKey(sessionId));
    return value ? (JSON.parse(value) as TestSessionState) : null;
  }
  const entry = memorySessions.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memorySessions.delete(sessionId);
    return null;
  }
  return structuredClone(entry.state);
}

export async function updateSession(
  sessionId: string,
  mutate: (state: TestSessionState) => TestSessionState,
): Promise<TestSessionState> {
  const client = await redisOrNull();
  if (client) {
    const key = sessionKey(sessionId);
    const lockKey = `${key}:update-lock`;
    const token = randomUUID();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const acquired = await client.set(lockKey, token, "PX", 5_000, "NX");
      if (acquired !== "OK") {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }
      try {
        const value = await client.get(key);
        if (!value) throw new SessionNotFoundError("Test session state was not found");
        const next = mutate(JSON.parse(value) as TestSessionState);
        await client.set(key, JSON.stringify(next), "EX", ttlForState(next));
        return next;
      } finally {
        await client.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          1,
          lockKey,
          token,
        );
      }
    }
    throw new SessionConflictError("Session was modified concurrently; retry the request");
  }

  return withMemoryLock(sessionId, async () => {
    const entry = memorySessions.get(sessionId);
    if (!entry || entry.expiresAt <= Date.now()) {
      memorySessions.delete(sessionId);
      throw new SessionNotFoundError("Test session state was not found");
    }
    const next = mutate(structuredClone(entry.state));
    memorySessions.set(sessionId, {
      state: structuredClone(next),
      expiresAt: Date.now() + ttlForState(next) * 1_000,
    });
    return next;
  });
}

async function withMemoryLock<T>(key: string, callback: () => Promise<T>): Promise<T> {
  const previous = memoryLocks.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  memoryLocks.set(key, queued);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (memoryLocks.get(key) === queued) memoryLocks.delete(key);
  }
}

export async function acquireCompletionLock(sessionId: string): Promise<() => Promise<void>> {
  const client = await redisOrNull();
  const key = `${process.env.SESSION_KEY_PREFIX ?? "tests:session"}:complete:${sessionId}`;
  const token = randomUUID();
  if (client) {
    const acquired = await client.set(key, token, "EX", 30, "NX");
    if (acquired !== "OK") throw new SessionConflictError("Test completion is already running");
    return async () => {
      await client.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        1,
        key,
        token,
      );
    };
  }
  if (completionLocks.has(sessionId)) {
    throw new SessionConflictError("Test completion is already running");
  }
  completionLocks.add(sessionId);
  return async () => {
    completionLocks.delete(sessionId);
  };
}

export function sessionTiming(state: TestSessionState, now = Date.now()) {
  const start = Date.parse(state.started_at);
  const deadline = Date.parse(state.deadline_at);
  const effectiveNow = state.completed_at ? Date.parse(state.completed_at) : now;
  return {
    elapsed: Math.max(0, Math.floor((Math.min(effectiveNow, deadline) - start) / 1_000)),
    remaining: state.status === "completed" ? 0 : Math.max(0, Math.ceil((deadline - now) / 1_000)),
  };
}

export function toSessionStatus(state: TestSessionState): SessionStatusResponse {
  const timing = sessionTiming(state);
  const expired = state.status === "active" && timing.remaining === 0;
  return {
    session_id: state.session_id,
    test_id: state.test_id,
    level: state.level,
    test_type: state.test_type,
    sections: state.sections,
    status: expired ? "expired" : state.status,
    current_question:
      state.status === "completed" ? null : (state.questions[state.current_index] ?? null),
    current_question_number: state.questions.length ? state.current_index + 1 : 0,
    total_questions: state.questions.length,
    answers_so_far: Object.values(state.answers),
    time_elapsed: timing.elapsed,
    time_remaining: timing.remaining,
  };
}

export function nextUnansweredIndex(
  state: TestSessionState,
  startingAfter: number,
): number {
  for (let offset = 1; offset <= state.questions.length; offset += 1) {
    const index = (startingAfter + offset) % state.questions.length;
    const question = state.questions[index];
    if (question && !state.answers[question.id]) return index;
  }
  return state.questions.length;
}

export function sectionIsComplete(state: TestSessionState, sectionType: string): boolean {
  const section = state.sections.find((candidate) => candidate.type === sectionType);
  return Boolean(section?.question_ids.every((id) => state.answers[id]));
}

export function clearSessionMemory(): void {
  memorySessions.clear();
  memoryLocks.clear();
  completionLocks.clear();
}

export function answerList(state: TestSessionState): SessionAnswer[] {
  return state.questions
    .map((question) => state.answers[question.id])
    .filter((answer): answer is SessionAnswer => Boolean(answer));
}
