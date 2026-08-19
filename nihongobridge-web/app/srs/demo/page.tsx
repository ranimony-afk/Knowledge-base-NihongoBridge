import type { Metadata } from "next";

import { SRSReviewDemo } from "@/components/srs/SRSReviewDemo";

export const metadata: Metadata = {
  title: "SRS Review · NihongoBridge",
};

export default function SrsDemoPage() {
  return <SRSReviewDemo />;
}
