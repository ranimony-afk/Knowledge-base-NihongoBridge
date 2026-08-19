import type { Metadata } from "next";
import { Suspense } from "react";

import { TestReview } from "@/components/test/TestReview";

export const metadata: Metadata = {
  title: "Test Review · NihongoBridge",
};

export default function TestReviewPage({ params }: { params: { sessionId: string } }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-washi" />}>
      <TestReview sessionId={params.sessionId} />
    </Suspense>
  );
}
