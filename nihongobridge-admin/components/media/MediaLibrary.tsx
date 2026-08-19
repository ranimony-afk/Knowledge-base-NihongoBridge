"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileAudio,
  FileImage,
  FileVideo,
  Headphones,
  Image as ImageIcon,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/admin/PageHeader";
import { FormField, inputClass, textareaClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { MediaAssetAdmin } from "@/types/admin";

const uploadSchema = z.object({
  relatedType: z.string(),
  relatedId: z.string(),
});
const ttsSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  voice: z.enum(["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"]),
});

export function MediaLibrary() {
  const media = useAdminStore((state) => state.media);
  const addMedia = useAdminStore((state) => state.addMedia);
  const deleteMedia = useAdminStore((state) => state.deleteMedia);
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [ttsOpen, setTtsOpen] = useState(false);
  const filtered = useMemo(
    () => media.filter((item) => (!query || item.filename.toLowerCase().includes(query.toLowerCase())) && (type === "ALL" || item.fileType === type)),
    [media, query, type],
  );
  const unused = media.filter((item) => !item.used);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="Media library"
        description="Upload, associate, preview, generate, and clean up audio, images, SVGs, and videos."
        actions={<><Button variant="secondary" onClick={() => setTtsOpen(true)}><Sparkles size={16} /> TTS generator</Button><Button onClick={() => setUploadOpen(true)}><Upload size={16} /> Upload media</Button></>}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames…" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></label>
          <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="ALL">All file types</option>{["audio","image","svg","pdf","video"].map((item) => <option key={item}>{item}</option>)}</select>
          <Button variant="danger" disabled={!unused.length} onClick={() => { if (window.confirm(`Delete ${unused.length} unused assets?`)) { deleteMedia(unused.map((item) => item.id)); toast.success("Unused media deleted and audited."); } }}><Trash2 size={15} /> Delete unused ({unused.length})</Button>
        </div>

        {selected.size ? <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3 text-sm"><strong>{selected.size} selected</strong><Button size="sm" variant="danger" onClick={() => { deleteMedia([...selected]); setSelected(new Set()); toast.success("Media deleted."); }}><Trash2 size={14} /> Delete</Button></div> : null}

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((item) => (
            <article key={item.id} className={`group overflow-hidden rounded-xl border bg-white ${selected.has(item.id) ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
              <button type="button" onClick={() => setSelected((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })} className="relative grid aspect-[4/3] w-full place-items-center bg-slate-50">
                <MediaIcon item={item} />
                <input type="checkbox" readOnly checked={selected.has(item.id)} aria-label={`Select ${item.filename}`} className="absolute left-3 top-3" />
                {!item.used ? <span className="absolute right-2 top-2 rounded-full bg-amber-50 px-2 py-1 text-[.6rem] font-bold text-amber-700">Unused</span> : null}
                {item.fileType === "audio" || item.fileType === "video" ? <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100"><i className="grid h-10 w-10 place-items-center rounded-full bg-slate-900/80 text-white"><Play size={17} fill="currentColor" /></i></span> : null}
              </button>
              <div className="p-3"><p className="truncate text-xs font-semibold" title={item.filename}>{item.filename}</p><div className="mt-2 flex items-center justify-between text-[.62rem] text-slate-400"><span className="uppercase">{item.fileType}</span><span>{formatBytes(item.sizeBytes)}</span></div><p className="mt-1 truncate text-[.62rem] text-slate-400">{item.relatedType ? `${item.relatedType} · linked` : "Unassociated"}</p></div>
            </article>
          ))}
        </div>
        {!filtered.length ? <div className="py-16 text-center text-sm text-slate-400">No media assets match this filter.</div> : null}
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{filtered.length} assets · {formatBytes(filtered.reduce((sum, item) => sum + item.sizeBytes, 0))}</div>
      </section>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onAdd={addMedia} />
      <TtsModal open={ttsOpen} onClose={() => setTtsOpen(false)} onAdd={addMedia} />
    </div>
  );
}

function UploadModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (assets: MediaAssetAdmin[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const toast = useToast();
  const form = useForm<z.infer<typeof uploadSchema>>({ resolver: zodResolver(uploadSchema), defaultValues: { relatedType: "", relatedId: "" } });
  const submit = form.handleSubmit((values) => {
    const assets = files.map((file) => fileAsset(file, values.relatedType, values.relatedId));
    onAdd(assets); toast.success(`${assets.length} media assets uploaded and audited.`); onClose(); setFiles([]);
  });
  return <Modal open={open} onClose={onClose} title="Upload media" description="Files can be automatically associated with a content item." size="md"><form onSubmit={submit} className="space-y-5"><label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center"><Upload className="text-admin" size={28} /><span className="mt-3 text-sm font-semibold">Choose one or more files</span><input type="file" multiple accept="audio/*,image/*,video/*,.svg,.pdf" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>{files.length ? <ul className="space-y-1 text-xs text-slate-500">{files.map((file) => <li key={`${file.name}-${file.size}`} className="flex justify-between rounded bg-slate-50 px-3 py-2"><span className="truncate">{file.name}</span><span>{formatBytes(file.size)}</span></li>)}</ul> : null}<div className="grid gap-4 sm:grid-cols-2"><FormField label="Related item type"><input className={inputClass} placeholder="sentence, word, kanji…" {...form.register("relatedType")} /></FormField><FormField label="Related item UUID"><input className={inputClass} placeholder="Optional" {...form.register("relatedId")} /></FormField></div><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!files.length}><Upload size={15} /> Upload</Button></div></form></Modal>;
}

function TtsModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (assets: MediaAssetAdmin[]) => void }) {
  const toast = useToast();
  const form = useForm<z.infer<typeof ttsSchema>>({ resolver: zodResolver(ttsSchema), defaultValues: { text: "日本語の勉強を続けましょう。", voice: "ja-JP-NanamiNeural" } });
  const submit = form.handleSubmit(async (values) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const file = new File([new Uint8Array(32_000)], `tts-${Date.now()}.mp3`, { type: "audio/mpeg" });
    onAdd([{ ...fileAsset(file, "tts", ""), voiceId: values.voice, durationMs: Math.max(800, values.text.length * 120) }]);
    toast.success("TTS audio generated and saved to the media library."); onClose();
  });
  return <Modal open={open} onClose={onClose} title="Generate Japanese speech" description="Edge TTS draft generator for pronunciation and listening media." size="md"><form onSubmit={submit} className="space-y-5"><FormField label="Japanese text" error={form.formState.errors.text?.message}><textarea className={`${textareaClass} jp-text min-h-36`} {...form.register("text")} /></FormField><FormField label="Voice"><select className={inputClass} {...form.register("voice")}><option>ja-JP-NanamiNeural</option><option>ja-JP-KeitaNeural</option></select></FormField><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}><Headphones size={15} /> {form.formState.isSubmitting ? "Generating…" : "Generate and save"}</Button></div></form></Modal>;
}

function fileAsset(file: File, relatedType: string, relatedId: string): MediaAssetAdmin {
  const type: MediaAssetAdmin["fileType"] = file.type.startsWith("audio") ? "audio" : file.type.startsWith("video") ? "video" : file.type.includes("svg") ? "svg" : file.type.includes("pdf") ? "pdf" : "image";
  return { id: crypto.randomUUID(), filename: file.name, fileType: type, mimeType: file.type || "application/octet-stream", url: URL.createObjectURL(file), sizeBytes: file.size, durationMs: null, relatedType: relatedType || null, relatedId: relatedId || null, voiceId: null, createdAt: new Date().toISOString(), used: Boolean(relatedId) };
}
function MediaIcon({ item }: { item: MediaAssetAdmin }) {
  const Icon = item.fileType === "audio" ? FileAudio : item.fileType === "video" ? FileVideo : item.fileType === "image" || item.fileType === "svg" ? FileImage : ImageIcon;
  return <Icon size={38} className="text-slate-300" />;
}
function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}
