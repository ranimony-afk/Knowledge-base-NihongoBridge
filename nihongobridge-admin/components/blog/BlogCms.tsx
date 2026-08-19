"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  CalendarClock,
  Heading2,
  Italic,
  Link2,
  List,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/admin/PageHeader";
import { FormField, inputClass, textareaClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAdminStore } from "@/stores/admin-store";
import type { BlogPostAdmin } from "@/types/admin";

const schema = z
  .object({
    title: z.string().trim().min(3),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug"),
    excerpt: z.string().max(300),
    status: z.enum(["draft", "published", "scheduled"]),
    tags: z.string(),
    categories: z.string(),
    seoTitle: z.string().max(70),
    seoDescription: z.string().max(170),
    scheduledFor: z.string(),
    relatedLabel: z.string(),
    relatedId: z.string(),
    relatedType: z.enum(["word", "kanji", "grammar", "sentence"]),
  })
  .refine((value) => value.status !== "scheduled" || Boolean(value.scheduledFor), {
    message: "Scheduled posts need a date and time",
    path: ["scheduledFor"],
  });
type Values = z.infer<typeof schema>;

export function BlogCms() {
  const posts = useAdminStore((state) => state.posts);
  const savePost = useAdminStore((state) => state.savePost);
  const deletePost = useAdminStore((state) => state.deletePost);
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(posts[0]?.id ?? "");
  const selected = posts.find((post) => post.id === selectedId) ?? null;
  const [isNew, setIsNew] = useState(false);
  const current = isNew ? null : selected;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: values(current) });
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write the lesson, examples, and learner guidance…" }),
    ],
    content: current?.html ?? "<p></p>",
    immediatelyRender: false,
  });

  useEffect(() => {
    form.reset(values(current));
    editor?.commands.setContent(current?.html ?? "<p></p>");
  }, [current, editor, form]);

  const submit = form.handleSubmit((data) => {
    const id = current?.id ?? crypto.randomUUID();
    const related = data.relatedId && data.relatedLabel
      ? [{ type: data.relatedType, id: data.relatedId, label: data.relatedLabel }]
      : current?.relatedContent ?? [];
    const post: BlogPostAdmin = {
      id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: (editor?.getJSON() ?? { type: "doc", content: [] }) as Record<string, unknown>,
      html: editor?.getHTML() ?? "",
      status: data.status,
      tags: split(data.tags),
      categories: split(data.categories),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      relatedContent: related,
      scheduledFor: data.status === "scheduled" ? new Date(data.scheduledFor).toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    savePost(post);
    setSelectedId(id);
    setIsNew(false);
    toast.success(`${data.title} saved as ${data.status}.`);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publishing"
        title="Blog CMS"
        description="Create searchable Japanese lessons with structured SEO and linked dictionary/grammar content."
        actions={<Button onClick={() => setIsNew(true)}><Plus size={16} /> New article</Button>}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[20rem_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 py-2 text-[.65rem] font-bold uppercase tracking-[.14em] text-slate-400">Articles</p>
          <div className="space-y-2">{posts.map((post) => <button key={post.id} type="button" onClick={() => { setIsNew(false); setSelectedId(post.id); }} className={`w-full rounded-xl border p-3 text-left ${!isNew && selectedId === post.id ? "border-admin bg-red-50/50" : "border-slate-100 hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><PostStatus status={post.status} /><span className="text-[.62rem] text-slate-400">{new Date(post.updatedAt).toLocaleDateString()}</span></div><p className="mt-2 line-clamp-2 text-sm font-semibold">{post.title}</p><p className="mt-1 truncate text-[.65rem] text-slate-400">/{post.slug}</p></button>)}</div>
        </aside>

        <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-5 border-b border-slate-200 p-5 lg:grid-cols-[1fr_14rem]">
            <div className="space-y-4">
              <FormField label="Title" error={form.formState.errors.title?.message}><input className={`${inputClass} text-base font-semibold`} {...form.register("title")} /></FormField>
              <FormField label="Slug" error={form.formState.errors.slug?.message}><div className="flex items-center rounded-lg border border-slate-200"><span className="pl-3 text-sm text-slate-400">/blog/</span><input className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" {...form.register("slug")} /></div></FormField>
            </div>
            <div className="space-y-4">
              <FormField label="Status"><select className={inputClass} {...form.register("status")}><option>draft</option><option>published</option><option>scheduled</option></select></FormField>
              {form.watch("status") === "scheduled" ? <FormField label="Schedule" error={form.formState.errors.scheduledFor?.message}><input type="datetime-local" className={inputClass} {...form.register("scheduledFor")} /></FormField> : null}
            </div>
          </div>

          <div className="border-b border-slate-200">
            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
              <EditorButton active={editor?.isActive("bold")} label="Bold" onClick={() => { editor?.chain().focus().toggleBold().run(); }}><Bold size={15} /></EditorButton>
              <EditorButton active={editor?.isActive("italic")} label="Italic" onClick={() => { editor?.chain().focus().toggleItalic().run(); }}><Italic size={15} /></EditorButton>
              <EditorButton active={editor?.isActive("heading", { level: 2 })} label="Heading" onClick={() => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); }}><Heading2 size={15} /></EditorButton>
              <EditorButton active={editor?.isActive("bulletList")} label="Bullet list" onClick={() => { editor?.chain().focus().toggleBulletList().run(); }}><List size={15} /></EditorButton>
              <EditorButton active={editor?.isActive("link")} label="Link" onClick={() => { const href = window.prompt("URL"); if (href) editor?.chain().focus().setLink({ href }).run(); }}><Link2 size={15} /></EditorButton>
            </div>
            <EditorContent editor={editor} className="min-h-[24rem] px-6 py-4" />
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-4"><FormField label="Excerpt"><textarea className={textareaClass} {...form.register("excerpt")} /></FormField><div className="grid grid-cols-2 gap-4"><FormField label="Tags"><input className={inputClass} placeholder="grammar, N3" {...form.register("tags")} /></FormField><FormField label="Categories"><input className={inputClass} placeholder="Grammar guides" {...form.register("categories")} /></FormField></div></div>
            <div className="space-y-4"><FormField label="SEO title" error={form.formState.errors.seoTitle?.message}><input className={inputClass} {...form.register("seoTitle")} /></FormField><FormField label="SEO description" error={form.formState.errors.seoDescription?.message}><textarea className={textareaClass} {...form.register("seoDescription")} /></FormField></div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-5">
            <h3 className="text-sm font-bold">Related knowledge content</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_1fr]"><select className={inputClass} {...form.register("relatedType")}><option>word</option><option>kanji</option><option>grammar</option><option>sentence</option></select><input className={inputClass} placeholder="Content UUID" {...form.register("relatedId")} /><input className={`${inputClass} jp-text`} placeholder="Display label" {...form.register("relatedLabel")} /></div>
            {current?.relatedContent.length ? <div className="mt-3 flex flex-wrap gap-2">{current.relatedContent.map((item) => <span key={`${item.type}-${item.id}`} className="jp-text rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs">{item.type}: {item.label}</span>)}</div> : null}
          </div>

          <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-200 p-4">
            {current ? <Button type="button" variant="danger" onClick={() => { if (window.confirm("Delete this post?")) { deletePost(current.id); setSelectedId(posts.find((item) => item.id !== current.id)?.id ?? ""); toast.success("Post deleted and audited."); } }}><Trash2 size={15} /> Delete</Button> : <span />}
            <Button type="submit"><Save size={15} /> Save article</Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function EditorButton({ active = false, label, onClick, children }: { active?: boolean | undefined; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={`grid h-8 w-8 place-items-center rounded ${active ? "bg-ink text-white" : "text-slate-500 hover:bg-slate-200"}`}>{children}</button>;
}
function PostStatus({ status }: { status: BlogPostAdmin["status"] }) {
  const color = status === "published" ? "bg-emerald-50 text-emerald-700" : status === "scheduled" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[.62rem] font-bold capitalize ${color}`}>{status === "scheduled" ? <CalendarClock size={11} /> : null}{status}</span>;
}
function values(post: BlogPostAdmin | null): Values {
  return { title: post?.title ?? "", slug: post?.slug ?? "", excerpt: post?.excerpt ?? "", status: post?.status ?? "draft", tags: post?.tags.join(", ") ?? "", categories: post?.categories.join(", ") ?? "", seoTitle: post?.seoTitle ?? "", seoDescription: post?.seoDescription ?? "", scheduledFor: post?.scheduledFor ? post.scheduledFor.slice(0, 16) : "", relatedLabel: "", relatedId: "", relatedType: "grammar" };
}
function split(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }
