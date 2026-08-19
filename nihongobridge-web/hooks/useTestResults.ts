"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { loadResultPage } from "@/lib/results-api";
import type { ResultPageData, WeakArea } from "@/types/results";

export function useTestResults(sessionId: string) {
  const [data, setData] = useState<ResultPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void loadResultPage(sessionId)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load results.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => load(), [load]);

  const weakAreas = useMemo(() => detectWeakAreas(data), [data]);
  return { data, loading, error, weakAreas, retry: load };
}

function detectWeakAreas(data: ResultPageData | null): WeakArea[] {
  if (!data) return [];
  const misses = new Map<string, WeakArea>();
  for (const question of data.review.questions) {
    if (question.is_correct) continue;
    for (const item of question.vocabulary) {
      const key = `word:${item.id}`;
      const existing = misses.get(key) ?? {
        id: item.id,
        type: "word" as const,
        label: item.word,
        misses: 0,
      };
      existing.misses += 1;
      misses.set(key, existing);
    }
    for (const item of question.grammar) {
      const key = `grammar:${item.id}`;
      const existing = misses.get(key) ?? {
        id: item.id,
        type: "grammar" as const,
        label: item.pattern,
        misses: 0,
      };
      existing.misses += 1;
      misses.set(key, existing);
    }
  }
  return [...misses.values()]
    .filter((item) => item.misses >= 2)
    .sort((left, right) => right.misses - left.misses);
}
