"use client";

import { useEffect, useRef } from "react";

import {
  sessionSnapshot,
  useTestSessionStore,
} from "@/stores/test-session-store";
import type { LocalSessionSnapshot } from "@/types/test";

const PREFIX = "nihongobridge:test-session:";

export function useSessionPersistence(): void {
  const sessionId = useTestSessionStore((state) => state.sessionId);
  const hydrated = useTestSessionStore((state) => state.hydrated);
  const restoreDraft = useTestSessionStore((state) => state.restoreDraft);
  const restoredSession = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || !hydrated || restoredSession.current === sessionId) return;
    restoredSession.current = sessionId;
    try {
      const value = window.localStorage.getItem(`${PREFIX}${sessionId}`);
      if (!value) return;
      const snapshot = JSON.parse(value) as LocalSessionSnapshot;
      if (
        snapshot.version === 1 &&
        snapshot.sessionId === sessionId &&
        Date.now() - Date.parse(snapshot.savedAt) < 24 * 60 * 60 * 1_000
      ) {
        restoreDraft(snapshot);
      }
    } catch {
      window.localStorage.removeItem(`${PREFIX}${sessionId}`);
    }
  }, [hydrated, restoreDraft, sessionId]);

  useEffect(() => {
    if (!sessionId || !hydrated) return;
    const save = () => {
      const snapshot = sessionSnapshot();
      if (!snapshot) return;
      try {
        window.localStorage.setItem(`${PREFIX}${sessionId}`, JSON.stringify(snapshot));
      } catch {
        // Storage may be unavailable in private/restricted browsing contexts.
      }
    };
    const interval = window.setInterval(save, 10_000);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [hydrated, sessionId]);
}

export function clearSessionSnapshot(sessionId: string): void {
  if (typeof window === "undefined") return;
  const key = `${PREFIX}${sessionId}`;
  try {
    const state = useTestSessionStore.getState();
    const currentFlags = state.sessionId === sessionId ? [...state.flaggedQuestions] : null;
    const value = window.localStorage.getItem(key);
    const snapshotFlags = value
      ? (JSON.parse(value) as LocalSessionSnapshot).flaggedQuestionIds
      : [];
    window.localStorage.setItem(
      `${PREFIX}flags:${sessionId}`,
      JSON.stringify(currentFlags ?? snapshotFlags),
    );
  } catch {
    // A malformed snapshot should never block completion.
  }
  window.localStorage.removeItem(key);
}

export function loadSessionFlags(sessionId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = window.localStorage.getItem(`${PREFIX}flags:${sessionId}`);
    const parsed = value ? (JSON.parse(value) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}
