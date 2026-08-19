import { demoQuestions, demoSessionStatus } from "@/lib/demo-session";
import type { CompleteResult } from "@/types/results";
import type {
  AnswerResponse,
  ApiEnvelope,
  SessionAnswer,
  SessionStatus,
  TestQuestion,
} from "@/types/test";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface LoadedSession {
  status: SessionStatus;
  knownQuestions: TestQuestion[];
}

export async function loadTestSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<LoadedSession> {
  if (isDemo(sessionId)) {
    await demoDelay();
    return { status: demoSessionStatus(), knownQuestions: demoQuestions };
  }
  const envelope = await apiRequest<ApiEnvelope<SessionStatus>>(
    `/api/tests/session/${encodeURIComponent(sessionId)}`,
    { method: "GET", ...(signal ? { signal } : {}) },
  );
  return {
    status: envelope.data,
    knownQuestions: envelope.data.current_question ? [envelope.data.current_question] : [],
  };
}

export async function submitTestAnswer(
  sessionId: string,
  answer: Pick<SessionAnswer, "question_id" | "selected" | "time_taken_ms">,
  signal?: AbortSignal,
): Promise<AnswerResponse> {
  if (isDemo(sessionId)) {
    await demoDelay();
    const index = demoQuestions.findIndex((question) => question.id === answer.question_id);
    const next = demoQuestions[index + 1];
    return {
      ...(next ? { next_question: next } : {}),
      section_complete:
        !next || next.section_type !== demoQuestions[index]?.section_type,
      test_complete: !next,
      time_remaining: demoSessionStatus().time_remaining,
    };
  }
  const envelope = await apiRequest<ApiEnvelope<AnswerResponse>>(
    `/api/tests/session/${encodeURIComponent(sessionId)}/answer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answer),
      ...(signal ? { signal } : {}),
    },
  );
  return envelope.data;
}

export async function completeTest(sessionId: string): Promise<CompleteResult> {
  if (isDemo(sessionId)) {
    await demoDelay();
    const { demoResultPageData } = await import("@/lib/demo-results");
    return demoResultPageData().result;
  }
  const envelope = await apiRequest<ApiEnvelope<CompleteResult>>(
    `/api/tests/session/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST" },
  );
  return envelope.data;
}

export async function apiRequest<T>(input: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  const token = accessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = body && typeof body === "object" ? Reflect.get(body, "error") : undefined;
    throw new ApiClientError(
      typeof error === "string" ? error : `Request failed with HTTP ${response.status}`,
      response.status,
    );
  }
  return body as T;
}

export function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("nihongobridge:access-token");
}

export function currentUserId(sessionId?: string): string | null {
  if (sessionId && isDemo(sessionId)) return "demo-user";
  const token = accessToken();
  if (!token) return null;
  try {
    const segment = token.split(".")[1] ?? "";
    const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function isDemo(sessionId: string): boolean {
  return sessionId === "demo" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

function demoDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 180));
}
