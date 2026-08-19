"use client";

import { Activity, BookOpen, Brain, Languages } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type {
  AccuracyPoint,
  DashboardData,
  HeatmapDay,
  MasteryLevel,
  TestScorePoint,
  WeakAreaTag,
} from "@/types/dashboard";

interface ProgressStatsProps {
  mastery: DashboardData["mastery"];
  testScores: TestScorePoint[];
  accuracyTrend: AccuracyPoint[];
  heatmap: HeatmapDay[];
  weakAreas: WeakAreaTag[];
}

export function ProgressStats({
  mastery,
  testScores,
  accuracyTrend,
  heatmap,
  weakAreas,
}: ProgressStatsProps) {
  return (
    <section aria-labelledby="progress-stats-title" className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Progress</p>
        <h2 id="progress-stats-title" className="mt-1 text-2xl font-semibold">What you have built</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <MasteryGroup title="Vocabulary mastered" icon={<Languages size={17} />} items={mastery.vocabulary} />
        <MasteryGroup title="Kanji mastered" icon={<BookOpen size={17} />} items={mastery.kanji} />
        <MasteryGroup title="Grammar known" icon={<Brain size={17} />} items={mastery.grammar} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Last 10 test scores" subtitle="Scaled to 180">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testScores} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(120,113,108,.14)" strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#78716c" }} />
                <YAxis domain={[0, 180]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a8a29e" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="score" stroke="#C0392B" strokeWidth={3} dot={{ r: 3, fill: "#FAFAF7", strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Accuracy trend" subtitle="Last 30 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracyTrend} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(120,113,108,.14)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                  tick={{ fontSize: 10, fill: "#78716c" }}
                  tickFormatter={(value: string) => value.slice(5)}
                />
                <YAxis domain={[40, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a8a29e" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Accuracy"]} labelFormatter={(label) => String(label)} />
                <Line type="monotone" dataKey="accuracy" stroke="#4D6B57" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_.85fr]">
        <ChartCard title="Time studied" subtitle="Last 3 months · contribution heatmap">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 4 }}>
                <XAxis type="number" dataKey="week" domain={[0, 12]} hide />
                <YAxis type="number" dataKey="day" domain={[0, 6]} reversed hide />
                <ZAxis type="number" range={[90, 90]} />
                <Tooltip
                  cursor={false}
                  contentStyle={tooltipStyle}
                  formatter={(_value, _name, item) => [
                    `${item.payload.minutes} min`,
                    item.payload.date,
                  ]}
                />
                <Scatter data={heatmap} shape="square">
                  {heatmap.map((day) => (
                    <Cell key={day.date} fill={heatColor(day.intensity)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[0.62rem] text-sumi/40 dark:text-washi/35">
            Less {Array.from({ length: 5 }, (_, value) => <span key={value} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: heatColor(value) }} />)} More
          </div>
        </ChartCard>

        <div className="rounded-2xl border border-sumi/10 bg-white/55 p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <h3 className="flex items-center gap-2 font-semibold"><Activity aria-hidden size={17} className="text-vermilion" /> Weak areas</h3>
          <p className="mt-1 text-xs text-sumi/40 dark:text-washi/35">Low-accuracy items to revisit</p>
          {weakAreas.length ? (
            <div className="mt-5 flex flex-wrap content-start gap-2">
              {weakAreas.map((item) => (
                <span
                  key={item.id}
                  title={`${item.accuracy}% across ${item.attempts} attempts`}
                  className="jp-text rounded-full border border-vermilion/15 bg-vermilion/[0.045] px-3 py-1.5 font-semibold text-vermilion"
                  style={{ fontSize: `${Math.max(12, 19 - item.accuracy / 12)}px` }}
                >
                  {item.label} <small className="opacity-60">{item.accuracy}%</small>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-moss dark:bg-emerald-950/30 dark:text-emerald-200">No repeated weak area found.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function MasteryGroup({ title, icon, items }: { title: string; icon: React.ReactNode; items: MasteryLevel[] }) {
  return (
    <article className="rounded-2xl border border-sumi/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      <div className="mt-5 grid grid-cols-5 gap-1">
        {items.map((item) => <MasteryRing key={item.level} item={item} />)}
      </div>
    </article>
  );
}

function MasteryRing({ item }: { item: MasteryLevel }) {
  const data = [{ value: item.percent, fill: item.percent >= 70 ? "#4D6B57" : "#C0392B" }];
  return (
    <div className="text-center" title={`${item.mastered} of ${item.total} mastered`}>
      <div className="relative mx-auto h-16 w-16 max-w-full sm:h-20 sm:w-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" background={{ fill: "rgba(120,113,108,.10)" }} cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <span className="absolute inset-0 grid place-items-center text-[0.68rem] font-bold tabular-nums sm:text-xs">{item.percent}%</span>
      </div>
      <p className="mt-1 text-[0.66rem] font-bold text-sumi/50 dark:text-washi/45">{item.level}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-sumi/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-sumi/40 dark:text-washi/35">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </article>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(120,113,108,.18)",
  background: "#FAFAF7",
  fontSize: 12,
};

function heatColor(intensity: number): string {
  return ["#E7E5E0", "#F2C6BE", "#E99384", "#D96051", "#A93226"][intensity] ?? "#E7E5E0";
}

export function ProgressStatsSkeleton() {
  return (
    <section className="space-y-4" aria-label="Loading progress statistics">
      <div className="h-8 w-56 animate-pulse rounded bg-sumi/8 dark:bg-white/10" />
      <div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-sumi/5 dark:bg-white/5" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="h-72 animate-pulse rounded-2xl bg-sumi/5 dark:bg-white/5" /><div className="h-72 animate-pulse rounded-2xl bg-sumi/5 dark:bg-white/5" /></div>
    </section>
  );
}
