"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Headphones, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  autocompleteDictionaryContent,
  searchDictionaryContent,
} from "@/lib/content-api";
import type {
  DictionaryAutocompleteItem,
  DictionaryEntryData,
  DictionarySearchFilters,
  JlptFilter,
} from "@/types/content";

interface DictionarySearchProps {
  demo?: boolean;
  onSelect?: (entry: DictionaryEntryData) => void;
}

const levels: JlptFilter[] = ["N5", "N4", "N3", "N2", "N1"];
const parts = ["noun", "verb", "adjective", "adverb"];

export function DictionarySearch({ demo = false, onSelect }: DictionarySearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [level, setLevel] = useState<JlptFilter | undefined>(
    parseLevel(searchParams.get("level")),
  );
  const [partOfSpeech, setPartOfSpeech] = useState<string | undefined>(
    searchParams.get("pos") || undefined,
  );
  const [hasAudio, setHasAudio] = useState(searchParams.get("audio") === "1");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page")) || 1));
  const [composing, setComposing] = useState(false);
  const [results, setResults] = useState<DictionaryEntryData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DictionaryAutocompleteItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchAbort = useRef<AbortController | null>(null);
  const filters: DictionarySearchFilters = useMemo(
    () => ({ q: query, level, pos: partOfSpeech, hasAudio, page }),
    [hasAudio, level, page, partOfSpeech, query],
  );

  useEffect(() => {
    if (composing) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (level) params.set("level", level);
      if (partOfSpeech) params.set("pos", partOfSpeech);
      if (hasAudio) params.set("audio", "1");
      if (page > 1) params.set("page", String(page));
      router.replace(params.size ? `?${params.toString()}` : "?", { scroll: false });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [composing, hasAudio, level, page, partOfSpeech, query, router]);

  useEffect(() => {
    if (composing) return;
    const timer = window.setTimeout(() => {
      searchAbort.current?.abort();
      const controller = new AbortController();
      searchAbort.current = controller;
      setLoading(true);
      setError(null);
      void searchDictionaryContent(filters, 20, demo)
        .then((value) => {
          if (controller.signal.aborted) return;
          setResults(value.items);
          setTotal(value.total);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : "Dictionary search failed.");
          setResults([]);
          setTotal(0);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [composing, demo, filters]);

  useEffect(() => {
    if (composing || query.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void autocompleteDictionaryContent(query.trim(), demo, controller.signal)
        .then((items) => {
          setSuggestions(items);
          setActiveSuggestion(-1);
          setSuggestionsOpen(Boolean(items.length));
        })
        .catch(() => setSuggestions([]));
    }, 130);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [composing, demo, query]);

  const chooseSuggestion = (item: DictionaryAutocompleteItem) => {
    setQuery(item.word);
    setPage(1);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

  return (
    <section aria-labelledby="dictionary-search-title">
      <div className="relative">
        <h1 id="dictionary-search-title" className="sr-only">Japanese dictionary search</h1>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSuggestionsOpen(false);
            setPage(1);
          }}
          className="relative"
        >
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sumi/35 dark:text-washi/35"
            size={24}
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(event) => {
              setComposing(false);
              setQuery(event.currentTarget.value);
            }}
            onFocus={() => suggestions.length && setSuggestionsOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            onKeyDown={(event) => {
              if (!suggestionsOpen) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestion((value) => Math.min(suggestions.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestion((value) => Math.max(-1, value - 1));
              } else if (event.key === "Enter" && activeSuggestion >= 0) {
                event.preventDefault();
                const item = suggestions[activeSuggestion];
                if (item) chooseSuggestion(item);
              } else if (event.key === "Escape") {
                setSuggestionsOpen(false);
              }
            }}
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            aria-controls="dictionary-suggestions"
            aria-activedescendant={
              activeSuggestion >= 0 ? `dictionary-suggestion-${activeSuggestion}` : undefined
            }
            inputMode="search"
            autoComplete="off"
            placeholder="日本語・かな・romaji・English"
            className="jp-text h-16 w-full rounded-2xl border-2 border-sumi/10 bg-white/80 pl-14 pr-14 text-lg shadow-paper outline-none transition placeholder:font-sans placeholder:text-sumi/30 focus:border-vermilion dark:border-white/10 dark:bg-white/[0.055] dark:placeholder:text-washi/25 sm:h-[4.5rem] sm:text-xl"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestionsOpen(false);
                setPage(1);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-sumi/40 hover:bg-sumi/5 hover:text-sumi dark:text-washi/40 dark:hover:bg-white/10"
            >
              <X aria-hidden size={19} />
            </button>
          ) : null}
        </form>

        <AnimatePresence>
          {suggestionsOpen ? (
            <motion.ul
              id="dictionary-suggestions"
              role="listbox"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute inset-x-0 top-[calc(100%+.45rem)] z-40 max-h-80 overflow-y-auto rounded-2xl border border-sumi/10 bg-washi/98 p-2 shadow-2xl dark:border-white/10 dark:bg-[#1D1D1A]"
            >
              {suggestions.map((item, index) => (
                <li
                  key={item.id}
                  id={`dictionary-suggestion-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestion}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSuggestion(item)}
                    className={`flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left ${
                      index === activeSuggestion
                        ? "bg-vermilion text-white"
                        : "hover:bg-sumi/5 dark:hover:bg-white/8"
                    }`}
                  >
                    <span className="jp-text min-w-20 text-lg font-semibold">{item.word}</span>
                    <span className={`jp-text text-sm ${index === activeSuggestion ? "text-white/75" : "text-sumi/45 dark:text-washi/40"}`}>
                      {item.kana}
                    </span>
                    <span className={`ml-auto truncate text-xs ${index === activeSuggestion ? "text-white/75" : "text-sumi/45 dark:text-washi/40"}`}>
                      {item.meaning}
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-sumi/40 dark:text-washi/35">
          <SlidersHorizontal size={14} /> Filters
        </span>
        {levels.map((item) => (
          <FilterChip
            key={item}
            active={level === item}
            label={item}
            onClick={() => {
              setLevel(level === item ? undefined : item);
              setPage(1);
            }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-sumi/10 dark:bg-white/10" />
        {parts.map((item) => (
          <FilterChip
            key={item}
            active={partOfSpeech === item}
            label={item}
            capitalize
            onClick={() => {
              setPartOfSpeech(partOfSpeech === item ? undefined : item);
              setPage(1);
            }}
          />
        ))}
        <FilterChip
          active={hasAudio}
          label="Has audio"
          onClick={() => {
            setHasAudio((value) => !value);
            setPage(1);
          }}
          icon={<Headphones size={13} />}
        />
      </div>

      <div className="mt-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-vermilion">Results</p>
          <p className="mt-1 text-sm text-sumi/45 dark:text-washi/40">
            {loading ? "Searching…" : `${total} entr${total === 1 ? "y" : "ies"}`}
          </p>
        </div>
        {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      </div>

      {loading ? (
        <DictionarySearchSkeleton />
      ) : results.length ? (
        <div className="mt-3 divide-y divide-sumi/8 overflow-hidden rounded-2xl border border-sumi/10 bg-white/55 dark:divide-white/8 dark:border-white/10 dark:bg-white/[0.035]">
          {results.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect?.(entry)}
              className="group flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white dark:hover:bg-white/[0.07] sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="jp-text text-xl font-semibold sm:text-2xl">{entry.word}</span>
                  <span className="jp-text text-sm text-sumi/45 dark:text-washi/40">{entry.kana}</span>
                  {entry.romaji ? <span className="text-xs text-sumi/35 dark:text-washi/30">/ {entry.romaji}</span> : null}
                </div>
                <p className="mt-1 truncate text-sm text-sumi/60 dark:text-washi/55">
                  {entry.meanings[0]?.value ?? "No meaning available"}
                </p>
              </div>
              <span className="rounded-full border border-vermilion/20 bg-vermilion/[0.04] px-2.5 py-1 text-xs font-bold text-vermilion">
                {entry.jlpt_level}
              </span>
              {entry.audio_url ? <Headphones aria-label="Has audio" size={16} className="text-moss" /> : null}
              <span aria-hidden className="text-sumi/20 transition group-hover:translate-x-1 group-hover:text-vermilion">→</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-sumi/20 py-14 text-center dark:border-white/15">
          <Search className="mx-auto text-sumi/20 dark:text-washi/20" size={28} />
          <p className="mt-3 text-sm font-semibold">No entries match these filters.</p>
          <p className="mt-1 text-xs text-sumi/40 dark:text-washi/35">Try another reading, meaning, or JLPT level.</p>
        </div>
      )}

      {total > 20 ? (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border border-sumi/10 px-3 py-2 text-xs font-semibold disabled:opacity-35 dark:border-white/10"
          >
            Previous
          </button>
          <span className="grid min-w-10 place-items-center text-xs tabular-nums text-sumi/45 dark:text-washi/40">{page}</span>
          <button
            type="button"
            disabled={page * 20 >= total}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-sumi/10 px-3 py-2 text-xs font-semibold disabled:opacity-35 dark:border-white/10"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  capitalize = false,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  capitalize?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        capitalize ? "capitalize" : ""
      } ${
        active
          ? "border-vermilion bg-vermilion text-white"
          : "border-sumi/10 bg-white/55 text-sumi/55 hover:border-sumi/25 hover:text-sumi dark:border-white/10 dark:bg-white/[0.04] dark:text-washi/55 dark:hover:text-washi"
      }`}
    >
      {active ? <Check aria-hidden size={12} strokeWidth={3} /> : icon}
      {label}
    </button>
  );
}

export function DictionarySearchSkeleton() {
  return (
    <div className="mt-3 divide-y divide-sumi/8 overflow-hidden rounded-2xl border border-sumi/10 bg-white/40 dark:divide-white/8 dark:border-white/10 dark:bg-white/[0.03]" aria-label="Loading dictionary results">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <div className="flex-1 space-y-2"><div className="h-6 w-36 rounded bg-sumi/8 dark:bg-white/10" /><div className="h-3 w-64 max-w-full rounded bg-sumi/5 dark:bg-white/[0.07]" /></div>
          <div className="h-7 w-12 rounded-full bg-sumi/8 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function parseLevel(value: string | null): JlptFilter | undefined {
  return value === "N5" || value === "N4" || value === "N3" || value === "N2" || value === "N1"
    ? value
    : undefined;
}
