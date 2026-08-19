"use client";

import { Bookmark, Brain, Headphones, LoaderCircle, Plus, Volume2 } from "lucide-react";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useSRSActions } from "@/hooks/useSRSActions";
import type {
  DictionaryDetailData,
  FuriganaSegment,
} from "@/types/content";

interface DictionaryEntryProps {
  entry: DictionaryDetailData;
  actionContext?: string;
  onKanji?: (character: string) => void;
  onGrammar?: (id: string) => void;
  onQuiz?: (entry: DictionaryDetailData) => void;
}

export function DictionaryEntry({
  entry,
  actionContext = "dictionary",
  onKanji,
  onGrammar,
  onQuiz,
}: DictionaryEntryProps) {
  const actions = useSRSActions(actionContext);
  const studyItem = { id: entry.id, type: "word" as const, label: entry.word };
  const srsState = actions.states[`srs:word:${entry.id}`] ?? "idle";
  const bookmarkState = actions.states[`bookmark:word:${entry.id}`] ?? "idle";

  return (
    <article className="overflow-hidden rounded-3xl border border-sumi/10 bg-white/65 shadow-paper dark:border-white/10 dark:bg-white/[0.045]">
      <header className="border-b border-sumi/10 bg-[#F6F3EC]/70 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <FuriganaWord segments={entry.furigana} fallback={entry.word} />
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-sumi/45 dark:text-washi/45">
              {entry.kana ? <span className="jp-text">{entry.kana}</span> : null}
              {entry.romaji ? <><span aria-hidden>/</span><span>{entry.romaji}</span></> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-vermilion px-2.5 py-1 text-white">JLPT {entry.jlpt_level}</span>
              {entry.part_of_speech.map((part) => (
                <span key={part} className="rounded-full border border-sumi/10 px-2.5 py-1 text-sumi/55 dark:border-white/10 dark:text-washi/55">
                  {part}
                </span>
              ))}
            </div>
          </div>
          <PronounceButton source={entry.audio_url} label={`Play pronunciation for ${entry.word}`} />
        </div>
      </header>

      <section className="border-b border-sumi/10 p-5 dark:border-white/10 sm:p-7">
        <h2 className="text-xs font-bold uppercase tracking-[0.17em] text-sumi/40 dark:text-washi/35">Meanings</h2>
        <ol className="mt-4 space-y-3">
          {entry.meanings.length ? (
            entry.meanings.map((meaning, index) => (
              <li key={`${meaning.lang}-${meaning.value}-${index}`} className="grid grid-cols-[1.8rem_1fr] gap-2">
                <span className="text-sm font-semibold text-vermilion">{index + 1}.</span>
                <div>
                  <p className="text-base leading-relaxed">{meaning.value}</p>
                  {meaning.pos ? <p className="mt-0.5 text-xs text-sumi/40 dark:text-washi/35">{meaning.pos}</p> : null}
                </div>
              </li>
            ))
          ) : (
            <li className="text-sm text-sumi/45 dark:text-washi/40">No meanings available.</li>
          )}
        </ol>
      </section>

      <section className="border-b border-sumi/10 p-5 dark:border-white/10 sm:p-7">
        <h2 className="text-xs font-bold uppercase tracking-[0.17em] text-sumi/40 dark:text-washi/35">Example sentences</h2>
        {entry.example_sentences.length ? (
          <div className="mt-4 space-y-4">
            {entry.example_sentences.map((sentence) => (
              <div key={sentence.id} className="rounded-2xl border border-sumi/8 bg-washi/70 p-4 dark:border-white/8 dark:bg-black/15">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <SafeJapaneseHtml
                      html={sentence.furigana_html ?? sentence.japanese}
                      className="text-base font-medium leading-[1.9] sm:text-lg"
                    />
                    <p className="jp-text mt-1 text-xs text-sumi/40 dark:text-washi/35">{sentence.japanese}</p>
                    <p className="mt-2 text-sm leading-relaxed text-sumi/60 dark:text-washi/55">
                      {sentence.translations.find((item) => item.lang === "en")?.value ?? ""}
                    </p>
                  </div>
                  <PronounceButton source={sentence.audio_url} label="Play example sentence" compact />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-sumi/45 dark:text-washi/40">No example sentences yet.</p>
        )}
      </section>

      <section className="border-b border-sumi/10 p-5 dark:border-white/10 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-sumi/40 dark:text-washi/35">Related kanji</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.related_kanji.length ? entry.related_kanji.map((kanji) => (
                <button
                  key={kanji.id}
                  type="button"
                  onClick={() => onKanji?.(kanji.character)}
                  className="jp-text grid h-11 w-11 place-items-center rounded-xl border border-sumi/10 bg-washi text-xl font-semibold hover:border-vermilion/40 dark:border-white/10 dark:bg-white/5"
                >
                  {kanji.character}
                </button>
              )) : <span className="text-sm text-sumi/40">—</span>}
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-sumi/40 dark:text-washi/35">Related grammar</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.grammar_patterns.length ? entry.grammar_patterns.map((grammar) => (
                <button
                  key={grammar.id}
                  type="button"
                  onClick={() => onGrammar?.(grammar.id)}
                  className="jp-text rounded-full border border-sumi/10 bg-washi px-3 py-2 text-sm font-semibold hover:border-vermilion/40 dark:border-white/10 dark:bg-white/5"
                >
                  {grammar.pattern}
                </button>
              )) : <span className="text-sm text-sumi/40">—</span>}
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap gap-2 p-4 sm:p-5">
        <ActionButton
          label={srsState === "done" ? "Added to SRS" : "Add to SRS"}
          working={srsState === "working"}
          done={srsState === "done"}
          onClick={() => void actions.addToSrs([studyItem])}
          icon={<Plus size={16} />}
        />
        <ActionButton
          label={bookmarkState === "done" ? "Bookmarked" : "Bookmark"}
          working={bookmarkState === "working"}
          done={bookmarkState === "done"}
          onClick={() => void actions.bookmark(studyItem, "Dictionary")}
          icon={<Bookmark size={16} />}
          secondary
        />
        <ActionButton
          label="Quiz"
          onClick={() => onQuiz?.(entry)}
          icon={<Brain size={16} />}
          secondary
        />
        {actions.message ? <p className="w-full pt-1 text-xs text-red-700 dark:text-red-300">{actions.message}</p> : null}
      </footer>
    </article>
  );
}

function FuriganaWord({ segments, fallback }: { segments: FuriganaSegment[]; fallback: string }) {
  if (!segments.length) {
    return <h1 className="jp-text text-4xl font-semibold sm:text-5xl">{fallback}</h1>;
  }
  return (
    <h1 className="jp-text text-4xl font-semibold sm:text-5xl" lang="ja">
      {segments.map((segment, index) =>
        segment.ruby ? (
          <ruby key={`${segment.base}-${index}`}>{segment.base}<rt>{segment.ruby}</rt></ruby>
        ) : (
          <span key={`${segment.base}-${index}`}>{segment.base}</span>
        ),
      )}
    </h1>
  );
}

function PronounceButton({
  source,
  label,
  compact = false,
}: {
  source: string | null;
  label: string;
  compact?: boolean;
}) {
  const player = useAudioPlayer(source);
  return (
    <div className="shrink-0">
      <audio ref={player.audioRef} {...player.audioProps} />
      <button
        type="button"
        onClick={() => void player.toggle()}
        disabled={!source}
        aria-label={source ? label : `${label}; audio unavailable`}
        className={`grid place-items-center rounded-full border transition ${
          compact ? "h-9 w-9" : "h-12 w-12"
        } ${
          source
            ? "border-vermilion/20 bg-vermilion/[0.055] text-vermilion hover:bg-vermilion hover:text-white"
            : "cursor-not-allowed border-sumi/8 text-sumi/20 dark:border-white/8 dark:text-white/20"
        }`}
      >
        {player.playing ? <Volume2 aria-hidden size={compact ? 16 : 20} /> : <Headphones aria-hidden size={compact ? 16 : 20} />}
      </button>
    </div>
  );
}

function ActionButton({
  label,
  working = false,
  done = false,
  secondary = false,
  icon,
  onClick,
}: {
  label: string;
  working?: boolean;
  done?: boolean;
  secondary?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={working || done}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-55 ${
        secondary
          ? "border border-sumi/15 bg-white/55 dark:border-white/15 dark:bg-white/5"
          : "bg-sumi text-washi dark:bg-washi dark:text-[#141412]"
      }`}
    >
      {working ? <LoaderCircle className="animate-spin" size={16} /> : icon}
      {label}
    </button>
  );
}

export function DictionaryEntryLoading() {
  return <div className="h-[44rem] animate-pulse rounded-3xl border border-sumi/10 bg-sumi/5 dark:border-white/10 dark:bg-white/5" aria-label="Loading dictionary entry" />;
}

export function DictionaryEntryEmpty() {
  return (
    <div className="grid min-h-[28rem] place-items-center rounded-3xl border border-dashed border-sumi/20 p-8 text-center dark:border-white/15">
      <div><Brain className="mx-auto text-sumi/20 dark:text-white/20" size={34} /><p className="mt-3 font-semibold">Select an entry to see its details.</p></div>
    </div>
  );
}
