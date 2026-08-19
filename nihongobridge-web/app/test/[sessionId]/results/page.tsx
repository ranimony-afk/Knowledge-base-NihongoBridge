import type { Metadata } from "next";

import { TestResults } from "@/components/test/TestResults";

export const metadata: Metadata = {
  title: "Test Results · NihongoBridge",
};

export default function TestResultsPage({ params }: { params: { sessionId: string } }) {
  return <TestResults sessionId={params.sessionId} />;
}
