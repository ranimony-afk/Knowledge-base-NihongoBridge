"use client";

import { Headphones, Pause, Play, RotateCcw, Users, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SafeJapaneseHtml } from "@/components/test/SafeJapaneseHtml";
import { useTestSessionStore } from "@/stores/test-session-store";
import type { JlptLevel, TestQuestion } from "@/types/test";

interface ListeningQuestionProps {
  question: TestQuestion;
  level: JlptLevel;
  reviewMode?: boolean;
}

export function ListeningQuestion({
  question,
  level,
  reviewMode = false,
}: ListeningQuestionProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentPlayStarted = useRef(false);
  const setTimerPaused = useTestSessionStore((state) => state.setTimerPaused);
  const [countdown, setCountdown] = useState(question.audio_url ? 3 : 0);
  const [playCount, setPlayCount] = useState(0);
  const [completedPlays, setCompletedPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const replayLimit =
    question.stimulus?.replay_limit ?? (["N1", "N2", "N3"].includes(level) ? 2 : 3);
  const transcript = question.stimulus?.transcript;
  const speakers = question.stimulus?.speakers ??
    (question.stimulus?.voices?.map((voice, index) => ({ name: `Speaker ${index + 1}`, id: voice })) ??
      []);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || (playCount >= replayLimit && !currentPlayStarted.current)) return;
    const newAttempt = !currentPlayStarted.current;
    try {
      if (newAttempt) {
        setPlayCount((value) => value + 1);
        currentPlayStarted.current = true;
      }
      await audio.play();
      setAutoplayBlocked(false);
    } catch {
      if (newAttempt) {
        setPlayCount((value) => Math.max(0, value - 1));
        currentPlayStarted.current = false;
      }
      setAutoplayBlocked(true);
      setPlaying(false);
      setTimerPaused(false);
    }
  }, [playCount, replayLimit, setTimerPaused]);

  useEffect(() => {
    setCountdown(question.audio_url ? 3 : 0);
    setPlayCount(0);
    setCompletedPlays(0);
    setProgress(0);
    setDuration(0);
    setAutoplayBlocked(false);
    setShowTranscript(false);
    currentPlayStarted.current = false;
    setTimerPaused(false);
    audioRef.current?.load();
  }, [question.audio_url, question.id, setTimerPaused]);

  useEffect(() => {
    if (countdown <= 0 || !question.audio_url) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [countdown, question.audio_url]);

  useEffect(() => {
    if (countdown === 0 && question.audio_url && playCount === 0) void startPlayback();
  }, [countdown, playCount, question.audio_url, startPlayback]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      setTimerPaused(false);
    },
    [setTimerPaused],
  );

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void startPlayback();
  };

  const seek = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (completedPlays < 1 || !audioRef.current || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    audioRef.current.currentTime = ratio * duration;
    setProgress(ratio * duration);
  };

  return (
    <section className="rounded-2xl border border-sumi/10 bg-[#F6F3EC] p-4 sm:p-6">
      <audio
        ref={audioRef}
        src={question.audio_url ?? undefined}
        preload="auto"
        onPlay={() => {
          setPlaying(true);
          setTimerPaused(true);
        }}
        onPause={() => {
          setPlaying(false);
          setTimerPaused(false);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setTimerPaused(false);
          setCompletedPlays((value) => value + 1);
          currentPlayStarted.current = false;
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-sumi text-white">
            <Headphones aria-hidden size={18} />
          </span>
          Listening audio
        </div>
        <span className="rounded-full border border-sumi/10 bg-white/60 px-2.5 py-1 text-xs text-sumi/55">
          {Math.max(0, replayLimit - playCount)} replay{replayLimit - playCount === 1 ? "" : "s"} left
        </span>
      </div>

      {speakers.length ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-sumi/55">
          <Users aria-hidden size={15} />
          {speakers.map((speaker, index) => (
            <span key={speaker.id ?? `${speaker.name}-${index}`} className="rounded-full bg-white/70 px-2 py-1">
              {speaker.name ?? `Speaker ${index + 1}`}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col items-center">
        {countdown > 0 ? (
          <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-vermilion/20 bg-white text-4xl font-bold text-vermilion">
            <span key={countdown} className="animate-countdown">{countdown}</span>
          </div>
        ) : question.audio_url ? (
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!playing && playCount >= replayLimit && !currentPlayStarted.current}
            aria-label={playing ? "Pause listening audio" : "Play listening audio"}
            className="grid h-20 w-20 place-items-center rounded-full bg-vermilion text-white shadow-stamp transition hover:-translate-y-0.5 hover:bg-[#A93226] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? <Pause aria-hidden size={31} fill="currentColor" /> : playCount ? (
              <RotateCcw aria-hidden size={29} />
            ) : (
              <Play aria-hidden className="ml-1" size={31} fill="currentColor" />
            )}
          </button>
        ) : (
          <div className="rounded-xl border border-dashed border-sumi/20 bg-white/50 px-5 py-4 text-center text-sm text-sumi/55">
            Audio is unavailable in this preview.
          </div>
        )}

        {autoplayBlocked ? (
          <p className="mt-3 text-center text-xs text-amber-800">
            Your browser blocked autoplay. Press the play button to begin.
          </p>
        ) : null}

        <div className="mt-6 flex w-full items-center gap-3">
          <Volume2 aria-hidden size={17} className="shrink-0 text-sumi/45" />
          <button
            type="button"
            onClick={seek}
            disabled={completedPlays < 1}
            aria-label={
              completedPlays < 1
                ? "Seeking is disabled during the first playback"
                : "Audio progress; click to seek"
            }
            className="relative h-3 flex-1 overflow-hidden rounded-full bg-sumi/10 disabled:cursor-not-allowed"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-vermilion transition-[width] duration-150"
              style={{ width: `${duration ? Math.min(100, (progress / duration) * 100) : 0}%` }}
            />
          </button>
          <span className="w-10 text-right text-xs tabular-nums text-sumi/45">
            {duration ? `${Math.floor(progress)}/${Math.ceil(duration)}s` : "—"}
          </span>
        </div>
        {completedPlays < 1 && question.audio_url ? (
          <p className="mt-2 text-xs text-sumi/40">Seeking unlocks after the first complete play.</p>
        ) : null}
      </div>

      {reviewMode && transcript?.length ? (
        <div className="mt-6 border-t border-sumi/10 pt-4">
          <button
            type="button"
            onClick={() => setShowTranscript((value) => !value)}
            className="text-sm font-semibold text-vermilion hover:underline"
          >
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
          {showTranscript ? (
            <div className="mt-3 space-y-2 rounded-xl bg-white/65 p-4">
              {transcript.map((line, index) => (
                <div key={`${line.speaker}-${index}`} className="flex gap-3">
                  <span className="w-8 shrink-0 text-xs font-bold text-vermilion">
                    {line.speaker ?? "—"}
                  </span>
                  <SafeJapaneseHtml html={line.text} className="text-sm leading-relaxed" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
