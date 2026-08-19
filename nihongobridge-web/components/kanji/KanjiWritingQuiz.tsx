"use client";

import { Eye, EyeOff, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Stroke = Point[];

interface KanjiWritingQuizProps {
  character: string;
  strokeCount: number;
  referencePaths?: string[];
  referenceSvgUrl?: string | null;
}

export function KanjiWritingQuiz({
  character,
  strokeCount,
  referencePaths = [],
  referenceSvgUrl,
}: KanjiWritingQuizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [score, setScore] = useState<number | null>(null);

  const redraw = useCallback((allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = document.documentElement.classList.contains("dark") ? "#F4F1E8" : "#1C1C1E";
    context.lineWidth = Math.max(4, bounds.width / 48);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => redraw(strokes));
    observer.observe(canvas);
    redraw(strokes);
    return () => observer.disconnect();
  }, [redraw, strokes]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStroke.current = [pointFromEvent(event)];
    setScore(null);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke.current) return;
    event.preventDefault();
    activeStroke.current.push(pointFromEvent(event));
    redraw([...strokes, activeStroke.current]);
  };
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke.current) return;
    event.preventDefault();
    const stroke = activeStroke.current;
    activeStroke.current = null;
    if (stroke.length > 1) setStrokes((values) => [...values, stroke]);
  };

  const compare = () => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes.length) {
      setScore(0);
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const points = strokes.flat();
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const widthCoverage = (maxX - minX) / Math.max(1, bounds.width);
    const heightCoverage = (maxY - minY) / Math.max(1, bounds.height);
    const countScore = Math.max(0, 100 - Math.abs(strokes.length - strokeCount) * 18);
    const coverageScore = Math.max(
      0,
      100 - (Math.abs(widthCoverage - 0.62) + Math.abs(heightCoverage - 0.68)) * 90,
    );
    const pathBonus = referencePaths.length
      ? Math.max(0, 12 - Math.abs(referencePaths.length - strokes.length) * 3)
      : 0;
    setScore(Math.min(100, Math.round(countScore * 0.62 + coverageScore * 0.38 + pathBonus)));
  };

  return (
    <section className="rounded-2xl border border-sumi/10 bg-[#F6F3EC]/70 p-4 dark:border-white/10 dark:bg-black/15 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-vermilion">Writing quiz</p>
          <p className="mt-1 text-sm text-sumi/50 dark:text-washi/45">
            Draw {character} in {strokeCount} strokes
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHints((value) => !value)}
          aria-pressed={showHints}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sumi/10 px-3 text-xs font-semibold dark:border-white/10"
        >
          {showHints ? <EyeOff aria-hidden size={15} /> : <Eye aria-hidden size={15} />}
          {showHints ? "Hide hint" : "Show hint"}
        </button>
      </div>

      <div className="relative mx-auto mt-4 aspect-square max-w-[24rem] overflow-hidden rounded-2xl border-2 border-sumi/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_49.7%,rgba(28,28,30,.08)_50%,transparent_50.3%),linear-gradient(to_bottom,transparent_49.7%,rgba(28,28,30,.08)_50%,transparent_50.3%)] dark:bg-[linear-gradient(to_right,transparent_49.7%,rgba(255,255,255,.08)_50%,transparent_50.3%),linear-gradient(to_bottom,transparent_49.7%,rgba(255,255,255,.08)_50%,transparent_50.3%)]" />
        {showHints ? (
          referenceSvgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={referenceSvgUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain p-5 opacity-15 dark:invert" />
          ) : (
            <span className="jp-text pointer-events-none absolute inset-0 grid place-items-center text-[11rem] font-light text-vermilion/15">
              {character}
            </span>
          )
        ) : null}
        {referencePaths.length && revealCount ? (
          <svg viewBox="0 0 109 109" className="pointer-events-none absolute inset-0 h-full w-full p-5 text-vermilion/55">
            {referencePaths.slice(0, revealCount).map((path, index) => (
              <path key={index} d={path} fill="none" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" />
            ))}
          </svg>
        ) : null}
        <canvas
          ref={canvasRef}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={`Drawing canvas for kanji ${character}`}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStrokes((values) => values.slice(0, -1))}
          disabled={!strokes.length}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sumi/10 px-3 text-xs font-semibold disabled:opacity-35 dark:border-white/10"
        >
          <Undo2 aria-hidden size={15} /> Undo
        </button>
        <button
          type="button"
          onClick={() => {
            setStrokes([]);
            setScore(null);
            setRevealCount(0);
            redraw([]);
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sumi/10 px-3 text-xs font-semibold dark:border-white/10"
        >
          <RotateCcw aria-hidden size={15} /> Clear
        </button>
        {referencePaths.length ? (
          <button
            type="button"
            onClick={() => setRevealCount((value) => (value >= referencePaths.length ? 0 : value + 1))}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-vermilion/20 px-3 text-xs font-semibold text-vermilion"
          >
            <Eye aria-hidden size={15} /> Reveal stroke {Math.min(referencePaths.length, revealCount + 1)}
          </button>
        ) : null}
        <button
          type="button"
          onClick={compare}
          className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg bg-sumi px-4 text-xs font-semibold text-washi dark:bg-washi dark:text-[#141412]"
        >
          <Sparkles aria-hidden size={15} /> Compare
        </button>
      </div>

      {score !== null ? (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${score >= 75 ? "bg-emerald-50 text-moss dark:bg-emerald-950/30 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`} aria-live="polite">
          <strong>{score}% similarity.</strong>{" "}
          {score >= 75
            ? "Good shape and stroke count. Compare the small details with the reference."
            : "Try matching the stroke count and filling more of the guide square."}
        </div>
      ) : null}
    </section>
  );
}
