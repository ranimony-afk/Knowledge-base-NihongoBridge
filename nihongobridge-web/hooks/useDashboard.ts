"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchDashboardData } from "@/lib/dashboard-api";

export function useDashboard(demo = false) {
  return useQuery({
    queryKey: ["dashboard", demo ? "demo" : "current-user"],
    queryFn: () => fetchDashboardData(demo),
    staleTime: 5 * 60 * 1_000,
  });
}
