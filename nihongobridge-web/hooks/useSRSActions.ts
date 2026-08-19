"use client";

import { useCallback, useState } from "react";

import {
  ApiClientError,
  apiRequest,
  currentUserId,
  isDemo,
} from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/test";

export interface StudyItem {
  id: string;
  type: "word" | "kanji" | "grammar" | "sentence";
  label: string;
}

type ActionState = "idle" | "working" | "done" | "error";

export function useSRSActions(sessionId: string) {
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const [message, setMessage] = useState<string | null>(null);

  const setState = (key: string, value: ActionState) =>
    setStates((current) => ({ ...current, [key]: value }));

  const addToSrs = useCallback(
    async (items: StudyItem[]) => {
      const userId = currentUserId(sessionId);
      if (!userId) {
        setMessage("Sign in again before adding study cards.");
        return;
      }
      const unique = [...new Map(items.map((item) => [`${item.type}:${item.id}`, item])).values()];
      for (const item of unique) {
        const key = `srs:${item.type}:${item.id}`;
        setState(key, "working");
        try {
          if (!isDemo(sessionId)) {
            await apiRequest<ApiEnvelope<unknown>>("/api/srs/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: userId,
                item_type: item.type,
                item_id: item.id,
              }),
            });
          } else {
            await wait();
          }
          setState(key, "done");
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 409) {
            setState(key, "done");
          } else {
            setState(key, "error");
            setMessage(error instanceof Error ? error.message : "Could not add an SRS card.");
          }
        }
      }
    },
    [sessionId],
  );

  const bookmark = useCallback(
    async (item: StudyItem, collectionName = "Test mistakes") => {
      const userId = currentUserId(sessionId);
      if (!userId) {
        setMessage("Sign in again before bookmarking.");
        return;
      }
      const key = `bookmark:${item.type}:${item.id}`;
      setState(key, "working");
      try {
        if (!isDemo(sessionId)) {
          await apiRequest<ApiEnvelope<unknown>>(
            `/api/user/${encodeURIComponent(userId)}/bookmark`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                item_type: item.type,
                item_id: item.id,
                collection_name: collectionName,
              }),
            },
          );
        } else {
          await wait();
        }
        setState(key, "done");
      } catch (error) {
        setState(key, "error");
        setMessage(error instanceof Error ? error.message : "Could not save the bookmark.");
      }
    },
    [sessionId],
  );

  return { states, message, setMessage, addToSrs, bookmark };
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 260));
}
