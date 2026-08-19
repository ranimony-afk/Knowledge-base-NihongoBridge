"use client";

import { useCallback, useEffect, useState } from "react";

import { loadSessionFlags } from "@/hooks/useSessionPersistence";
import { loadTestReview } from "@/lib/results-api";
import type { TestReviewData } from "@/types/results";

export function useTestReview(sessionId: string) {
  const [data, setData] = useState<TestReviewData | null>(null);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setFlags(loadSessionFlags(sessionId));
    void loadTestReview(sessionId)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load review.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => load(), [load]);
  return { data, flags, loading, error, retry: load };
}
