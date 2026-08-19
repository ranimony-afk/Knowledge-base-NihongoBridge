"use client";

import { Pause, Play, Volume2 } from "lucide-react";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { formatTime } from "@/lib/test-utils";

export function ReviewAudioPlayer({ source }: { source: string }) {
  const player = useAudioPlayer(source);
  return (
    <div className="mt-5 rounded-xl border border-sumi/10 bg-[#F6F3EC] p-4">
      <audio ref={player.audioRef} {...player.audioProps} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void player.toggle()}
          aria-label={player.playing ? "Pause audio" : "Play audio"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-vermilion text-white"
        >
          {player.playing ? <Pause aria-hidden size={18} fill="currentColor" /> : <Play aria-hidden className="ml-0.5" size={18} fill="currentColor" />}
        </button>
        <Volume2 aria-hidden size={16} className="text-sumi/40" />
        <input
          type="range"
          min={0}
          max={player.duration || 0}
          step={0.1}
          value={Math.min(player.currentTime, player.duration || 0)}
          onChange={(event) => player.seek(Number(event.target.value))}
          aria-label="Audio position"
          className="h-2 min-w-0 flex-1 accent-vermilion"
        />
        <span className="w-24 text-right text-xs tabular-nums text-sumi/45">
          {formatTime(player.currentTime)} / {formatTime(player.duration)}
        </span>
      </div>
      {player.error ? <p className="mt-2 text-xs text-red-700">{player.error}</p> : null}
    </div>
  );
}
