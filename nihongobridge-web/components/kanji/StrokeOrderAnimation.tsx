"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

interface StrokeOrderAnimationProps {
  character: string;
  strokeCount: number | null;
  svgUrl?: string | null;
  initialPaths?: string[];
}

export function StrokeOrderAnimation({
  character,
  strokeCount,
  svgUrl,
  initialPaths = [],
}: StrokeOrderAnimationProps) {
  const [paths, setPaths] = useState(initialPaths);
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [currentStroke, setCurrentStroke] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!svgUrl || initialPaths.length) return;
    const controller = new AbortController();
    void fetch(svgUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Stroke SVG unavailable");
        return response.text();
      })
      .then((svg) => {
        const documentValue = new DOMParser().parseFromString(svg, "image/svg+xml");
        const safePaths = [...documentValue.querySelectorAll("path")]
          .map((path) => path.getAttribute("d"))
          .filter((value): value is string => Boolean(value && value.length <= 10_000))
          .slice(0, 64);
        if (safePaths.length) setPaths(safePaths);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialPaths.length, svgUrl]);

  useEffect(() => {
    if (!playing) return;
    setCurrentStroke(0);
    const count = paths.length || strokeCount || 1;
    const interval = window.setInterval(() => {
      setCurrentStroke((value) => {
        if (value + 1 >= count) {
          window.clearInterval(interval);
          setPlaying(false);
          return count;
        }
        return value + 1;
      });
    }, reduceMotion ? 80 : 520);
    return () => window.clearInterval(interval);
  }, [paths.length, playing, reduceMotion, strokeCount]);

  const play = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlayKey((value) => value + 1);
    setCurrentStroke(0);
    setPlaying(true);
  };

  const count = paths.length || strokeCount || 0;
  return (
    <div className="rounded-2xl border border-sumi/10 bg-[#F6F3EC]/70 p-4 dark:border-white/10 dark:bg-black/15">
      <div className="relative mx-auto aspect-square max-w-[17rem] overflow-hidden rounded-xl border border-sumi/10 bg-white/75 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_49.7%,rgba(28,28,30,.07)_50%,transparent_50.3%),linear-gradient(to_bottom,transparent_49.7%,rgba(28,28,30,.07)_50%,transparent_50.3%)] dark:bg-[linear-gradient(to_right,transparent_49.7%,rgba(255,255,255,.08)_50%,transparent_50.3%),linear-gradient(to_bottom,transparent_49.7%,rgba(255,255,255,.08)_50%,transparent_50.3%)]" />
        {paths.length ? (
          <svg key={playKey} viewBox="0 0 109 109" className="relative h-full w-full p-4" aria-label={`Animated stroke order for ${character}`}>
            {paths.map((path, index) => (
              <motion.path
                key={`${index}-${path.slice(0, 12)}`}
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: playing ? 0 : 1, opacity: playing ? 0.25 : 1 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: {
                    delay: playing && !reduceMotion ? index * 0.52 : 0,
                    duration: reduceMotion ? 0.01 : 0.45,
                  },
                  opacity: { delay: playing && !reduceMotion ? index * 0.52 : 0 },
                }}
                className="text-sumi dark:text-washi"
              />
            ))}
          </svg>
        ) : (
          <motion.span
            key={playKey}
            initial={playing && !reduceMotion ? { opacity: 0.1, scale: 0.82 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="jp-text relative grid h-full place-items-center text-[8rem] font-light text-sumi dark:text-washi"
          >
            {character}
          </motion.span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={play}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sumi px-4 text-sm font-semibold text-washi dark:bg-washi dark:text-[#141412]"
        >
          {playing ? <Pause aria-hidden size={16} /> : currentStroke >= count && count ? <RotateCcw aria-hidden size={16} /> : <Play aria-hidden size={16} />}
          {playing ? "Pause" : currentStroke >= count && count ? "Replay" : "Play"}
        </button>
        <div className="flex max-w-[65%] flex-wrap justify-end gap-1" aria-label={`${currentStroke} of ${count} strokes shown`}>
          {Array.from({ length: count }, (_, index) => (
            <span
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index < currentStroke ? "bg-vermilion" : "bg-sumi/15 dark:bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
