"use client";

import { ArrowRight, CalendarClock, Target } from "lucide-react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ReadinessData } from "@/types/dashboard";

export function LevelReadinessCheck({ data }: { data: ReadinessData }) {
  const breakdown = [
    { name: "Vocabulary", value: data.vocabulary, fill: "#C0392B" },
    { name: "Kanji", value: data.kanji, fill: "#B7791F" },
    { name: "Grammar", value: data.grammar, fill: "#4D6B57" },
    { name: "Tests", value: data.tests, fill: "#4F6F8F" },
  ];
  return (
    <section className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-vermilion">Level readiness</p>
          <h2 className="mt-1 text-xl font-semibold">
            {data.currentLevel} <span className="text-sumi/25 dark:text-washi/25">→</span> {data.targetLevel}
          </h2>
        </div>
        <Target aria-hidden className="text-vermilion" size={24} />
      </div>

      <div className="mt-5 grid items-center gap-5 sm:grid-cols-[10rem_1fr]">
        <div className="relative mx-auto h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="74%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              data={[{ value: data.overall, fill: data.overall >= 75 ? "#4D6B57" : "#C0392B" }]}
            >
              <RadialBar dataKey="value" background={{ fill: "rgba(120,113,108,.10)" }} cornerRadius={10} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><p className="text-3xl font-bold tabular-nums">{data.overall}%</p><p className="text-[0.65rem] text-sumi/40 dark:text-washi/35">ready</p></div>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdown} layout="vertical" margin={{ top: 4, right: 38, bottom: 4, left: 4 }}>
              <CartesianGrid horizontal={false} stroke="rgba(120,113,108,.12)" />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={74} tick={{ fontSize: 11, fill: "#78716c" }} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(value) => [`${value}%`, "Readiness"]} />
              <Bar dataKey="value" radius={[0, 7, 7, 0]} background={{ fill: "rgba(120,113,108,.08)" }}>
                {breakdown.map((item) => <Cell key={item.name} fill={item.fill} />)}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value) => `${Number(value ?? 0)}%`}
                  className="fill-current text-[10px]"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F6F3EC] px-4 py-3 text-sm text-sumi/60 dark:bg-black/20 dark:text-washi/55">
        <CalendarClock aria-hidden size={17} className="text-vermilion" />
        About <strong className="text-sumi dark:text-washi">{data.estimatedDays} days</strong> at your current SRS pace.
      </div>

      <Link
        href="/test/demo"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-washi transition hover:-translate-y-0.5 dark:bg-washi dark:text-[#141412]"
      >
        Take level check test <ArrowRight aria-hidden size={16} />
      </Link>
    </section>
  );
}

export function LevelReadinessSkeleton() {
  return <div className="h-[33rem] animate-pulse rounded-2xl bg-sumi/5 dark:bg-white/5" aria-label="Loading level readiness" />;
}
