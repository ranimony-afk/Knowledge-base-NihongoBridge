"use client";

import { create } from "zustand";

import {
  demoAdmin,
  demoBlogPosts,
  demoDictionary,
  demoKanji,
  demoMedia,
  demoPipelines,
  demoQuestions,
  demoTests,
} from "@/lib/demo-data";
import type {
  AuditRecord,
  BlogPostAdmin,
  DictionaryAdminEntry,
  KanjiAdminEntry,
  MediaAssetAdmin,
  PipelineRunAdmin,
  PracticeTestAdmin,
  QuestionAdminEntry,
} from "@/types/admin";

interface AdminStore {
  dictionary: DictionaryAdminEntry[];
  kanji: KanjiAdminEntry[];
  questions: QuestionAdminEntry[];
  tests: PracticeTestAdmin[];
  media: MediaAssetAdmin[];
  pipelines: PipelineRunAdmin[];
  posts: BlogPostAdmin[];
  audit: AuditRecord[];
  updateDictionary: (id: string, changes: Partial<DictionaryAdminEntry>) => void;
  bulkDictionary: (
    ids: string[],
    operation: { level?: DictionaryAdminEntry["jlptLevel"]; addTag?: string; delete?: boolean },
  ) => void;
  importDictionary: (entries: DictionaryAdminEntry[]) => void;
  updateKanji: (id: string, changes: Partial<KanjiAdminEntry>) => void;
  updateQuestion: (id: string, changes: Partial<QuestionAdminEntry>) => void;
  addQuestions: (entries: QuestionAdminEntry[]) => void;
  bulkQuestions: (
    ids: string[],
    operation: { level?: QuestionAdminEntry["level"]; addTag?: string },
  ) => void;
  addTest: (test: PracticeTestAdmin) => void;
  updateTest: (id: string, changes: Partial<PracticeTestAdmin>) => void;
  reorderTestQuestions: (id: string, questionIds: string[]) => void;
  addMedia: (assets: MediaAssetAdmin[]) => void;
  deleteMedia: (ids: string[]) => void;
  startPipeline: (pipeline: PipelineRunAdmin["pipeline"]) => string;
  appendPipelineLog: (id: string, line: string) => void;
  finishPipeline: (id: string, success: boolean) => void;
  updatePipelineSchedule: (id: string, schedule: string | null, enabled: boolean) => void;
  savePost: (post: BlogPostAdmin) => void;
  deletePost: (id: string) => void;
}

export const useAdminStore = create<AdminStore>((set, get) => {
  const addAudit = (
    action: AuditRecord["action"],
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
    changed?: string[],
  ) => {
    const record: AuditRecord = {
      id: crypto.randomUUID(),
      actor: demoAdmin,
      action,
      entityType,
      entityId,
      diff: { before, after, ...(changed ? { changed } : {}) },
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ audit: [record, ...state.audit].slice(0, 250) }));
    if (process.env.NEXT_PUBLIC_ADMIN_DEMO_MODE !== "true") {
      void fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => undefined);
    }
  };

  return {
    dictionary: structuredClone(demoDictionary),
    kanji: structuredClone(demoKanji),
    questions: structuredClone(demoQuestions),
    tests: structuredClone(demoTests),
    media: structuredClone(demoMedia),
    pipelines: structuredClone(demoPipelines),
    posts: structuredClone(demoBlogPosts),
    audit: [],
    updateDictionary: (id, changes) => {
      const before = get().dictionary.find((item) => item.id === id);
      set((state) => ({
        dictionary: state.dictionary.map((item) =>
          item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item,
        ),
      }));
      addAudit("update", "dictionary_entry", id, before, changes, Object.keys(changes));
    },
    bulkDictionary: (ids, operation) => {
      const selected = get().dictionary.filter((item) => ids.includes(item.id));
      set((state) => ({
        dictionary: operation.delete
          ? state.dictionary.filter((item) => !ids.includes(item.id))
          : state.dictionary.map((item) =>
              ids.includes(item.id)
                ? {
                    ...item,
                    ...(operation.level ? { jlptLevel: operation.level } : {}),
                    ...(operation.addTag
                      ? { tags: [...new Set([...item.tags, operation.addTag])] }
                      : {}),
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
      }));
      addAudit(operation.delete ? "delete" : "update", "dictionary_entry_bulk", ids.join(","), selected, operation);
    },
    importDictionary: (entries) => {
      set((state) => ({ dictionary: [...entries, ...state.dictionary] }));
      addAudit("create", "dictionary_import", `batch-${Date.now()}`, null, {
        count: entries.length,
      });
    },
    updateKanji: (id, changes) => {
      const before = get().kanji.find((item) => item.id === id);
      set((state) => ({
        kanji: state.kanji.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      }));
      addAudit("update", "kanji_entry", id, before, changes, Object.keys(changes));
    },
    updateQuestion: (id, changes) => {
      const before = get().questions.find((item) => item.id === id);
      set((state) => ({
        questions: state.questions.map((item) =>
          item.id === id ? { ...item, ...changes } : item,
        ),
      }));
      addAudit("update", "question", id, before, changes, Object.keys(changes));
    },
    addQuestions: (entries) => {
      set((state) => ({ questions: [...entries, ...state.questions] }));
      addAudit("create", "question_batch", `batch-${Date.now()}`, null, { count: entries.length });
    },
    bulkQuestions: (ids, operation) => {
      set((state) => ({
        questions: state.questions.map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                ...(operation.level ? { level: operation.level } : {}),
                ...(operation.addTag
                  ? { tags: [...new Set([...item.tags, operation.addTag])] }
                  : {}),
              }
            : item,
        ),
      }));
      addAudit("update", "question_bulk", ids.join(","), null, operation);
    },
    addTest: (test) => {
      set((state) => ({ tests: [test, ...state.tests] }));
      addAudit("create", "practice_test", test.id, null, test);
    },
    updateTest: (id, changes) => {
      const before = get().tests.find((item) => item.id === id);
      set((state) => ({
        tests: state.tests.map((item) =>
          item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item,
        ),
      }));
      addAudit("update", "practice_test", id, before, changes, Object.keys(changes));
    },
    reorderTestQuestions: (id, questionIds) => {
      get().updateTest(id, { questionIds });
    },
    addMedia: (assets) => {
      set((state) => ({ media: [...assets, ...state.media] }));
      addAudit("create", "media_batch", `batch-${Date.now()}`, null, { count: assets.length });
    },
    deleteMedia: (ids) => {
      const before = get().media.filter((item) => ids.includes(item.id));
      set((state) => ({ media: state.media.filter((item) => !ids.includes(item.id)) }));
      addAudit("delete", "media_asset_bulk", ids.join(","), before, null);
    },
    startPipeline: (pipeline) => {
      const id = crypto.randomUUID();
      const run: PipelineRunAdmin = {
        id,
        pipeline,
        status: "running",
        startedAt: new Date().toISOString(),
        completedAt: null,
        recordsImported: 0,
        errorCount: 0,
        logs: [`[${new Date().toLocaleTimeString()}] Starting ${pipeline} pipeline…`],
        schedule: null,
        enabled: false,
      };
      set((state) => ({ pipelines: [run, ...state.pipelines] }));
      addAudit("create", "etl_pipeline_run", id, null, { pipeline });
      return id;
    },
    appendPipelineLog: (id, line) =>
      set((state) => ({
        pipelines: state.pipelines.map((item) =>
          item.id === id
            ? {
                ...item,
                logs: [...item.logs, line],
                recordsImported: item.recordsImported + Math.floor(Math.random() * 2_000 + 500),
              }
            : item,
        ),
      })),
    finishPipeline: (id, success) => {
      const before = get().pipelines.find((item) => item.id === id);
      set((state) => ({
        pipelines: state.pipelines.map((item) =>
          item.id === id
            ? {
                ...item,
                status: success ? "completed" : "failed",
                completedAt: new Date().toISOString(),
                logs: [...item.logs, success ? "Pipeline completed." : "Pipeline failed."],
                errorCount: success ? item.errorCount : item.errorCount + 1,
              }
            : item,
        ),
      }));
      addAudit("update", "etl_pipeline_run", id, before, { status: success ? "completed" : "failed" });
    },
    updatePipelineSchedule: (id, schedule, enabled) => {
      set((state) => ({
        pipelines: state.pipelines.map((item) =>
          item.id === id ? { ...item, schedule, enabled } : item,
        ),
      }));
      addAudit("update", "etl_schedule", id, null, { schedule, enabled });
    },
    savePost: (post) => {
      const before = get().posts.find((item) => item.id === post.id);
      set((state) => ({
        posts: before
          ? state.posts.map((item) => (item.id === post.id ? post : item))
          : [post, ...state.posts],
      }));
      addAudit(before ? "update" : "create", "blog_post", post.id, before, post);
    },
    deletePost: (id) => {
      const before = get().posts.find((item) => item.id === id);
      set((state) => ({ posts: state.posts.filter((item) => item.id !== id) }));
      addAudit("delete", "blog_post", id, before, null);
    },
  };
});
