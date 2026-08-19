"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookA,
  Braces,
  DatabaseZap,
  FileQuestion,
  Languages,
  Play,
  Send,
  SpellCheck2,
  TestTube2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { demoDashboard } from "@/lib/demo-data";
import { useAdminStore } from "@/stores/admin-store";

const countMeta = [
  { key: "words", label: "Words", icon: Languages, color: "text-blue-700 bg-blue-50" },
  { key: "kanji", label: "Kanji", icon: SpellCheck2, color: "text-violet-700 bg-violet-50" },
  { key: "grammar", label: "Grammar", icon: Braces, color: "text-amber-700 bg-amber-50" },
  { key: "sentences", label: "Sentences", icon: BookA, color: "text-emerald-700 bg-emerald-50" },
  { key: "tests", label: "Tests", icon: TestTube2, color: "text-rose-700 bg-rose-50" },
  { key: "questions", label: "Questions", icon: FileQuestion, color: "text-cyan-700 bg-cyan-50" },
] as const;

export function AdminDashboard() {
  const router = useRouter();
  const audit = useAdminStore((state) => state.audit);
  const pipelines = useAdminStore((state) => state.pipelines);
  const lastPipeline = pipelines[0] ?? demoDashboard.lastPipeline;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Overview"
        title="Content operations"
        description="Monitor the knowledge base, review queues, test quality, and data pipelines from one workspace."
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push("/admin/etl")}><Play size={16} /> Run ETL</Button>
            <Button variant="secondary" onClick={() => router.push("/admin/questions")}><FileQuestion size={16} /> Generate questions</Button>
            <Button onClick={() => router.push("/admin/tests")}><Send size={16} /> Publish test</Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Content counts">
        {countMeta.map((meta) => {
          const Icon = meta.icon;
          return (
            <article key={meta.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${meta.color}`}><Icon size={18} /></span>
              <p className="mt-4 text-2xl font-bold tabular-nums">{demoDashboard.counts[meta.key].toLocaleString()}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{meta.label}</p>
            </article>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between">
            <div><h2 className="font-bold">Weekly content activity</h2><p className="mt-1 text-xs text-slate-500">Imports, generation, and completed reviews</p></div>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demoDashboard.weeklyChanges} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="words" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="questions" fill="#B63A2E" radius={[3, 3, 0, 0]} />
                <Bar dataKey="reviews" fill="#55735E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Review queue</h2><p className="mt-1 text-xs text-slate-500">Items needing a human decision</p></div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle size={19} /></span>
          </div>
          <p className="mt-7 text-5xl font-bold tabular-nums">{demoDashboard.pendingReviews}</p>
          <p className="mt-2 text-sm text-slate-500">pending reviews</p>
          <div className="mt-5 space-y-2">
            {demoDashboard.recentAdditions.slice(2).map((item) => (
              <div key={item.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{item.type}</span><span className="font-semibold tabular-nums">+{item.count}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => router.push("/admin/questions")} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-admin">
            Open review queue <ArrowRight size={15} />
          </button>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-bold">ETL pipeline status</h2><p className="mt-1 text-xs text-slate-500">Most recent source update</p></div><DatabaseZap className="text-admin" size={21} /></div>
          {lastPipeline ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold">{lastPipeline.pipeline}</p><StatusBadge status={lastPipeline.status} /></div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm"><Metric label="Records" value={lastPipeline.recordsImported.toLocaleString()} /><Metric label="Errors" value={String(lastPipeline.errorCount)} /><Metric label="Started" value={new Date(lastPipeline.startedAt).toLocaleDateString()} /></dl>
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">No pipeline runs.</p>}
        </section>

        <section id="audit" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Recent audit activity</h2>
          <p className="mt-1 text-xs text-slate-500">Every demo mutation appears here immediately</p>
          {audit.length ? (
            <ul className="mt-4 space-y-2">{audit.slice(0, 5).map((record) => <li key={record.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className={`h-2 w-2 rounded-full ${record.action === "delete" ? "bg-red-500" : record.action === "create" ? "bg-emerald-500" : "bg-blue-500"}`} /><span className="font-semibold capitalize">{record.action}</span><span className="min-w-0 flex-1 truncate text-slate-500">{record.entityType} · {record.entityId}</span><time className="text-slate-400">now</time></li>)}</ul>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Make an edit to populate the audit trail.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "completed" ? "bg-emerald-50 text-emerald-700" : status === "running" ? "bg-blue-50 text-blue-700" : status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${color}`}>{status}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[.65rem] uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>;
}
