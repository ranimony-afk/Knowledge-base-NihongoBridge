"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyActivity } from "@/types/dashboard";

export function RecentActivityChart({ activity }: { activity: DailyActivity[] }) {
  const data = activity.map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${item.date}T12:00:00`)),
  }));
  return (
    <div className="h-56 w-full" aria-label="Recent seven-day study activity chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 2, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(120,113,108,.14)" strokeDasharray="3 3" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#78716c" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a8a29e" }} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(192,57,43,.045)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(120,113,108,.18)",
              background: "#FAFAF7",
              fontSize: 12,
            }}
            formatter={(value, name) => [String(value), name === "cards" ? "Cards" : "Tests"]}
          />
          <Bar dataKey="cards" fill="#C0392B" radius={[5, 5, 0, 0]} maxBarSize={28} />
          <Bar dataKey="tests" fill="#4D6B57" radius={[5, 5, 0, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
