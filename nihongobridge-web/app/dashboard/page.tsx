import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard · NihongoBridge",
  description: "Study streak, JLPT progress, goals, readiness, and recent activity.",
};

export default function DashboardPage() {
  return <Dashboard demo />;
}
