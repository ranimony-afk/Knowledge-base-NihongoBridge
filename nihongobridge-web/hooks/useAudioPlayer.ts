"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayer(source: string | null) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.currentTime = 0;
      audio.load();
    }
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, [source]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !source) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setError("Audio playback was blocked. Try again.");
    }
  }, [source]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.min(audio.duration || 0, Math.max(0, seconds));
  }, []);

  return {
    audioRef,
    playing,
    currentTime,
    duration,
    error,
    toggle,
    seek,
    audioProps: {
      src: source ?? undefined,
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => setPlaying(false),
      onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement>) =>
        setCurrentTime(event.currentTarget.currentTime),
      onLoadedMetadata: (event: React.SyntheticEvent<HTMLAudioElement>) =>
        setDuration(event.currentTarget.duration || 0),
      onError: () => setError("Audio could not be loaded."),
    },
  };
}
