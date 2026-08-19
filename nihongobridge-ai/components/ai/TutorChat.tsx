"use client";

import {
  ArrowUp,
  Bot,
  GraduationCap,
  MessageCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MarkdownMessage } from "@/components/ai/MarkdownMessage";
import { requestTutorReply } from "@/lib/tutor-client";
import type { TutorContext, TutorMessage } from "@/types/tutor";

interface DisplayMessage extends TutorMessage {
  id: string;
}

export interface TutorChatProps {
  context: TutorContext;
  topicLabel?: string;
  accessToken?: string;
  apiBaseUrl?: string;
  storageKey?: string;
  initialOpen?: boolean;
  demoMode?: boolean;
}

const QUICK_ACTIONS = [
  { label: "Explain this grammar", text: "Please explain this grammar simply." },
  { label: "Give me an example", text: "Give me another original example and explain it." },
  { label: "Quiz me on this", text: "Quiz me on this topic with one short question. Do not reveal the answer yet." },
] as const;

const DEMO_REPLY = `The pattern **〜てから** means “after doing A, do B.” It shows a clear order of events.\n\n<ruby>朝<rt>あさ</rt></ruby>ごはんを<ruby>食<rt>た</rt></ruby>べてから、<ruby>学校<rt>がっこう</rt></ruby>へ<ruby>行<rt>い</rt></ruby>きます。  \n*After eating breakfast, I go to school.*\n\nUse the **て-form + から**. It is wrong to use the dictionary form before から here because the completed first action needs the て-form connection.\n\n**Next:** Learn **〜たあとで** for another way to say “after.”`;

function loadMessages(key: string): DisplayMessage[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): DisplayMessage[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      if (
        (record.role !== "user" && record.role !== "assistant") ||
        typeof record.content !== "string" ||
        typeof record.id !== "string"
      ) return [];
      return [{ role: record.role, content: record.content.slice(0, 12_000), id: record.id }];
    }).slice(-50);
  } catch {
    return [];
  }
}

function endpoint(baseUrl: string | undefined): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_AI_API_BASE_URL ?? "";
  return `${base.replace(/\/$/, "")}/api/ai/tutor/chat`;
}

export function TutorChat({
  context,
  topicLabel,
  accessToken,
  apiBaseUrl,
  storageKey = "nihongobridge:tutor:conversation:v1",
  initialOpen = false,
  demoMode = false,
}: TutorChatProps) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(loadMessages(storageKey));
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)));
    } catch {
      // Storage can be unavailable in private browsing; chat remains usable in memory.
    }
  }, [hydrated, messages, storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639px)").matches) document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const history = useMemo<TutorMessage[]>(
    () => messages.filter((message) => message.content.trim()).slice(-10).map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const updateAssistant = (id: string, updater: (content: string) => string) => {
    setMessages((current) => current.map((message) =>
      message.id === id ? { ...message, content: updater(message.content) } : message,
    ));
  };

  const send = async (rawMessage: string) => {
    const text = rawMessage.trim();
    if (!text || streaming) return;
    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMessage: DisplayMessage = { id: assistantId, role: "assistant", content: "" };
    const priorHistory = history;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setError(null);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (demoMode) {
        for (const character of DEMO_REPLY) {
          if (controller.signal.aborted) return;
          updateAssistant(assistantId, (content) => content + character);
          await new Promise((resolve) => window.setTimeout(resolve, 7));
        }
      } else {
        await requestTutorReply({
          endpoint: endpoint(apiBaseUrl),
          ...(accessToken ? { token: accessToken } : {}),
          body: {
            message: text,
            context,
            conversation_history: priorHistory,
          },
          signal: controller.signal,
          onToken: (token) => updateAssistant(assistantId, (content) => content + token),
        });
      }
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const message = requestError instanceof Error ? requestError.message : "Hana-sensei is unavailable";
      setError(message);
      updateAssistant(assistantId, (content) => content || "I’m sorry—I couldn’t answer that just now.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setStreaming(false);
    setError(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // No-op when storage is unavailable.
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex min-h-14 items-center gap-3 rounded-full bg-vermilion px-4 text-sm font-bold text-white shadow-[0_12px_36px_rgba(192,57,43,.3)] transition hover:-translate-y-0.5 hover:bg-[#A93226] sm:bottom-7 sm:right-7"
        aria-label="Open Hana-sensei AI tutor"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-hidden>
          <MessageCircle size={20} />
        </span>
        <span className="hidden pr-1 sm:inline">Ask Hana-sensei</span>
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Hana-sensei AI tutor"
      className="fixed inset-0 z-50 flex animate-chat-in flex-col overflow-hidden bg-washi dark:bg-[#141412] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100vh-3rem))] sm:w-[420px] sm:rounded-[28px] sm:border sm:border-sumi/10 sm:shadow-[0_24px_80px_rgba(28,28,30,.18)] sm:dark:border-white/10"
    >
      <header className="relative shrink-0 overflow-hidden border-b border-sumi/10 bg-[#F1ECE1] px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] dark:border-white/10 dark:bg-[#211F1A] sm:px-5 sm:pt-4">
        <div className="absolute -right-5 -top-9 h-28 w-28 rounded-full border-[18px] border-vermilion/[0.06]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-vermilion text-white shadow-stamp">
            <GraduationCap size={23} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold tracking-[-0.01em]">Hana-sensei</h2>
              <span className="h-2 w-2 rounded-full bg-[#4D8A5E] ring-4 ring-[#4D8A5E]/10" aria-label="Online" />
            </div>
            <p className="mt-0.5 text-xs text-sumi/50 dark:text-washi/45">AI Japanese tutor · {context.current_level}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={!messages.length}
            className="grid h-10 w-10 place-items-center rounded-full text-sumi/45 transition hover:bg-black/5 hover:text-sumi disabled:opacity-25 dark:text-washi/45 dark:hover:bg-white/5 dark:hover:text-washi"
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-full text-sumi/55 transition hover:bg-black/5 hover:text-sumi dark:text-washi/55 dark:hover:bg-white/5 dark:hover:text-washi"
            aria-label="Close tutor"
          >
            <X size={20} />
          </button>
        </div>
        {(topicLabel ?? context.current_topic) ? (
          <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-vermilion/15 bg-white/65 px-3 py-1.5 text-xs font-semibold text-vermilion dark:bg-white/[0.06]">
            <Sparkles size={13} aria-hidden />
            <span>Studying: <span className="jp-text">{topicLabel ?? context.current_topic}</span></span>
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin] sm:px-5" aria-live="polite">
        {!messages.length ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl border border-vermilion/15 bg-vermilion/[0.055] text-vermilion">
              <Bot size={29} aria-hidden />
            </div>
            <h3 className="mt-4 text-lg font-bold">こんにちは！</h3>
            <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-sumi/50 dark:text-washi/45">
              Ask me about grammar, vocabulary, or a sentence you would like corrected.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <article
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[88%] ${message.role === "assistant" ? "flex items-start gap-2.5" : ""}`}>
                  {message.role === "assistant" ? (
                    <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-vermilion text-white" aria-hidden>
                      <Bot size={15} />
                    </span>
                  ) : null}
                  <div className={message.role === "user"
                    ? "rounded-[20px] rounded-br-md bg-sumi px-4 py-3 text-sm leading-relaxed text-washi dark:bg-washi dark:text-[#141412]"
                    : "min-w-0 rounded-[20px] rounded-bl-md border border-sumi/8 bg-white/75 px-4 py-3 shadow-[0_3px_14px_rgba(28,28,30,.04)] dark:border-white/8 dark:bg-white/[0.055]"
                  }>
                    {message.content ? (
                      message.role === "assistant"
                        ? <MarkdownMessage content={message.content} />
                        : <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <span className="flex h-6 items-center gap-1" aria-label="Hana-sensei is thinking">
                        {[0, 1, 2].map((dot) => (
                          <span key={dot} className="h-1.5 w-1.5 animate-blink rounded-full bg-vermilion" style={{ animationDelay: `${dot * 140}ms` }} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                {index === messages.length - 1 ? <span className="sr-only">Latest message</span> : null}
              </article>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <footer className="shrink-0 border-t border-sumi/10 bg-white/55 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-white/10 dark:bg-white/[0.025] sm:px-4">
        <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => void send(action.text)}
              disabled={streaming}
              className="shrink-0 rounded-full border border-sumi/10 bg-washi px-3 py-2 text-xs font-semibold text-sumi/65 transition hover:border-vermilion/35 hover:text-vermilion disabled:opacity-45 dark:border-white/10 dark:bg-white/5 dark:text-washi/60"
            >
              {action.label}
            </button>
          ))}
        </div>
        {error ? <p className="mb-2 px-1 text-xs font-medium text-red-700 dark:text-red-300">{error}</p> : null}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-sumi/12 bg-washi p-2 pl-3 shadow-inner dark:border-white/12 dark:bg-black/20">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 4_000))}
            onKeyDown={onInputKeyDown}
            placeholder="Ask Hana-sensei…"
            disabled={streaming}
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-5 outline-none placeholder:text-sumi/35 disabled:opacity-60 dark:placeholder:text-washi/30"
            aria-label="Message Hana-sensei"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-vermilion text-white shadow-stamp transition hover:bg-[#A93226] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
            aria-label="Send message"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-sumi/35 dark:text-washi/30">Hana-sensei can make mistakes. Check important details.</p>
      </footer>
    </section>
  );
}
