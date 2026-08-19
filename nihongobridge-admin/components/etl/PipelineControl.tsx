"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarClock,
  CheckCircle2,
  CircleStop,
  DatabaseZap,
  Download,
  Play,
  TerminalSquare,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/admin/PageHeader";
import { FormField, inputClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { PipelineRunAdmin } from "@/types/admin";

const scheduleSchema = z.object({
  cron: z.string().trim().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, "Use a five-field cron expression"),
  enabled: z.boolean(),
});

type PipelineName = PipelineRunAdmin["pipeline"];
const pipelineDescriptions: Record<PipelineName, string> = {
  JMdict: "Dictionary entries, POS, glosses, tags",
  KANJIDIC2: "Kanji readings, meanings, frequency",
  KanjiVG: "Stroke-order SVG animations",
  Tatoeba: "Sentences, translations, furigana",
  TTS: "Sentence and dictionary audio",
  Questions: "Original JLPT-style question bank",
};

export function PipelineControl() {
  const runs = useAdminStore((state) => state.pipelines);
  const start = useAdminStore((state) => state.startPipeline);
  const append = useAdminStore((state) => state.appendPipelineLog);
  const finish = useAdminStore((state) => state.finishPipeline);
  const updateSchedule = useAdminStore((state) => state.updatePipelineSchedule);
  const toast = useToast();
  const [activeRun, setActiveRun] = useState<string | null>(
    runs.find((item) => item.status === "running")?.id ?? null,
  );
  const [scheduleRun, setScheduleRun] = useState<PipelineRunAdmin | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>());

  useEffect(
    () => () => timers.current.forEach((timer) => clearInterval(timer)),
    [],
  );

  const launch = (pipeline: PipelineName) => {
    const id = start(pipeline);
    setActiveRun(id);
    toast.success(`${pipeline} pipeline started.`);
    let step = 0;
    const lines = [
      "Checking source checksum…",
      "Source ready; opening streaming parser…",
      "Transforming and validating batch…",
      "Upserting records into PostgreSQL…",
      "Writing validation report…",
    ];
    const timer = setInterval(() => {
      append(id, `[${new Date().toLocaleTimeString()}] ${lines[step] ?? "Finalizing…"}`);
      step += 1;
      if (step >= lines.length) {
        clearInterval(timer);
        timers.current.delete(id);
        finish(id, true);
        toast.success(`${pipeline} pipeline completed.`);
      }
    }, 900);
    timers.current.set(id, timer);
  };

  const current = runs.find((item) => item.id === activeRun) ?? null;
  const latestByPipeline = Object.keys(pipelineDescriptions).map(
    (pipeline) => runs.find((item) => item.pipeline === pipeline) ?? null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data operations"
        title="ETL pipeline control"
        description="Run imports, stream logs, manage cron schedules, and inspect validation history."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(pipelineDescriptions) as PipelineName[]).map((pipeline, index) => {
          const latest = latestByPipeline[index];
          const running = runs.some((item) => item.pipeline === pipeline && item.status === "running");
          return (
            <article key={pipeline} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-admin"><DatabaseZap size={20} /></span>{latest ? <RunStatus status={latest.status} /> : null}</div>
              <h2 className="mt-4 font-bold">{pipeline}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{pipelineDescriptions[pipeline]}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Last import</dt><dd className="mt-1 font-semibold tabular-nums">{latest?.recordsImported.toLocaleString() ?? "—"}</dd></div><div><dt className="text-slate-400">Schedule</dt><dd className="mt-1 truncate font-mono text-[.67rem]">{latest?.schedule ?? "Manual"}</dd></div></dl>
              <div className="mt-5 flex gap-2"><Button size="sm" disabled={running} onClick={() => launch(pipeline)}><Play size={14} /> {running ? "Running" : "Run now"}</Button><Button size="sm" variant="secondary" onClick={() => latest && setScheduleRun(latest)} disabled={!latest}><CalendarClock size={14} /> Schedule</Button>{running ? <Button size="sm" variant="ghost" onClick={() => setActiveRun(runs.find((item) => item.pipeline === pipeline && item.status === "running")?.id ?? null)}><TerminalSquare size={14} /></Button> : null}</div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-bold">Import report history</h2><p className="mt-1 text-xs text-slate-500">Latest 25 pipeline runs</p></div><Button size="sm" variant="secondary"><Download size={14} /> Export reports</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-[.68rem] uppercase text-slate-500"><tr><th className="px-4 py-3">Pipeline</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Started</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Imported</th><th className="px-3 py-3">Errors</th><th className="px-3 py-3">Logs</th></tr></thead><tbody>{runs.slice(0, 25).map((run) => <tr key={run.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{run.pipeline}</td><td className="px-3 py-3"><RunStatus status={run.status} /></td><td className="px-3 py-3 text-xs text-slate-500">{new Date(run.startedAt).toLocaleString()}</td><td className="px-3 py-3 text-xs">{duration(run)}</td><td className="px-3 py-3 font-semibold tabular-nums">{run.recordsImported.toLocaleString()}</td><td className={`px-3 py-3 font-semibold ${run.errorCount ? "text-red-600" : "text-slate-400"}`}>{run.errorCount}</td><td className="px-3 py-3"><Button size="sm" variant="ghost" onClick={() => setActiveRun(run.id)}><TerminalSquare size={13} /> View</Button></td></tr>)}</tbody></table></div>
      </section>

      <Modal open={Boolean(current)} onClose={() => setActiveRun(null)} title={`${current?.pipeline ?? "Pipeline"} live log`} description="Server-Sent Events compatible output" size="lg">
        <div className="rounded-xl bg-[#111827] p-4 font-mono text-xs leading-6 text-emerald-300"><div className="admin-scrollbar max-h-[26rem] overflow-y-auto">{current?.logs.map((line, index) => <p key={`${line}-${index}`}><span className="mr-2 text-white/30">{String(index + 1).padStart(3, "0")}</span>{line}</p>)}</div>{current?.status === "running" ? <p className="animate-pulse text-white/45">▋</p> : null}</div>
        <div className="mt-4 flex items-center justify-between"><RunStatus status={current?.status ?? "queued"} /><span className="text-sm text-slate-500">{current?.recordsImported.toLocaleString()} records · {current?.errorCount} errors</span></div>
      </Modal>
      <ScheduleModal run={scheduleRun} open={Boolean(scheduleRun)} onClose={() => setScheduleRun(null)} onSave={(cron, enabled) => { if (scheduleRun) updateSchedule(scheduleRun.id, cron, enabled); toast.success("Pipeline schedule updated."); setScheduleRun(null); }} />
    </div>
  );
}

function ScheduleModal({ run, open, onClose, onSave }: { run: PipelineRunAdmin | null; open: boolean; onClose: () => void; onSave: (cron: string, enabled: boolean) => void }) {
  const form = useForm<z.infer<typeof scheduleSchema>>({ resolver: zodResolver(scheduleSchema), values: { cron: run?.schedule ?? "0 2 * * 0", enabled: run?.enabled ?? true } });
  return <Modal open={open} onClose={onClose} title={`Schedule ${run?.pipeline ?? "pipeline"}`} description="Five-field UTC cron expression" size="md"><form onSubmit={form.handleSubmit((values) => onSave(values.cron, values.enabled))} className="space-y-5"><FormField label="Cron expression" error={form.formState.errors.cron?.message} hint="minute hour day-of-month month day-of-week"><input className={`${inputClass} font-mono`} {...form.register("cron")} /></FormField><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" {...form.register("enabled")} /> Enable automatic runs</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save schedule</Button></div></form></Modal>;
}

function RunStatus({ status }: { status: PipelineRunAdmin["status"] }) {
  const icon = status === "completed" ? <CheckCircle2 size={12} /> : status === "failed" ? <XCircle size={12} /> : status === "running" ? <Play size={12} /> : <CircleStop size={12} />;
  const color = status === "completed" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-red-50 text-red-700" : status === "running" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[.65rem] font-bold capitalize ${color}`}>{icon}{status}</span>;
}
function duration(run: PipelineRunAdmin): string {
  if (!run.completedAt) return "Running";
  const seconds = Math.max(0, (Date.parse(run.completedAt) - Date.parse(run.startedAt)) / 1000);
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
