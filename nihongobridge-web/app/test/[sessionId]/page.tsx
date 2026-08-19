import type { Metadata } from "next";

import { TestSession } from "@/components/test/TestSession";

export const metadata: Metadata = {
  title: "Practice Test · NihongoBridge",
};

export default function TestSessionPage({ params }: { params: { sessionId: string } }) {
  return <TestSession sessionId={params.sessionId} />;
}
