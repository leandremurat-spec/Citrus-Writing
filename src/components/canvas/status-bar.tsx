import { Check, CloudOff, Loader2 } from "lucide-react";

import { getSweetSpotState, type SweetSpotZone } from "@/lib/editor/sweet-spot";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import type { SaveState } from "@/components/workspace/live-chapter";

export interface StatusBarProps {
  wordCount: number;
  sweetSpotMin: number;
  sweetSpotMax: number;
  saveState: SaveState;
  /** Stable per-chapter seed so the encouraging message stays put while typing. */
  messageSeed?: number;
}

const ZONE_TEXT: Record<SweetSpotZone, string> = {
  empty: "text-muted-foreground",
  warming: "text-muted-foreground",
  building: "text-ochre/90",
  close: "text-ochre",
  sweet: "text-press",
  over: "text-proof",
  "far-over": "text-proof",
};

const ZONE_FILL: Record<SweetSpotZone, string> = {
  empty: "bg-muted-foreground/40",
  warming: "bg-ochre/60",
  building: "bg-ochre/80",
  close: "bg-ochre",
  sweet: "bg-press",
  over: "bg-proof",
  "far-over": "bg-proof",
};

/**
 * The editor footer, kept deliberately quiet: where the chapter stands, and whether the work
 * is safe. Streaks, daily goal, and the added/removed breakdown live in the Progress panel,
 * where there is room to read them.
 */
export function StatusBar({ wordCount, sweetSpotMin, sweetSpotMax, saveState, messageSeed = 0 }: StatusBarProps) {
  const spot = getSweetSpotState(wordCount, sweetSpotMin, sweetSpotMax, messageSeed);

  return (
    <footer className="@container relative flex h-status shrink-0 items-center overflow-hidden border-t border-divider bg-chrome px-5 text-xs whitespace-nowrap text-muted-foreground">
      <div className="flex shrink-0 items-baseline gap-1">
        <span className="text-sm text-foreground tabular-nums">{formatNumber(wordCount)}</span>
        <span>words</span>
        {/* What a reader is actually being asked for. 230wpm is the usual prose figure, and
            it is only shown once there is enough text for the number to mean anything. */}
        {wordCount >= 100 && (
          <span className="hidden text-subtle @lg:inline">· {Math.max(1, Math.round(wordCount / 230))} min read</span>
        )}
      </div>

      {/*
        Centred on the footer itself, not on the space left over between the count and the save
        state — so the gauge does not drift sideways as the word count grows a digit. The bar
        sits above its number, which is the way round it was arranged on the design canvas.
      */}
      <div className="absolute left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 @md:flex">
        <SweetSpotBar value={wordCount} min={sweetSpotMin} max={sweetSpotMax} zone={spot.zone} />
        <span
          key={spot.caption}
          className={cn("text-2xs duration-surface ease-out-quiet animate-in fade-in", ZONE_TEXT[spot.zone])}
        >
          {spot.caption}
        </span>
      </div>

      <div className="flex-1" />
      {/* Autosave used to change silently. A polite live region says "Saved" once, when it
          changes, without interrupting typing. */}
      <div role="status" aria-live="polite" className="shrink-0">
        <SaveIndicator state={saveState} />
      </div>
    </footer>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-proof">
        <CloudOff className="size-3" /> Not saved
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-ochre" aria-hidden /> Unsaved
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Check className="size-3 text-press" /> Saved
    </span>
  );
}

/**
 * The sweet-spot track, with the target band shaded behind the fill.
 *
 * A real `role="progressbar"` by way of Base UI, not the `role="img"` this used
 * to be: a screen reader now gets the live word count as a value it can track,
 * and `getAriaValueText` says where the target sits instead of leaving that in
 * a label that never updates.
 */
export function SweetSpotBar({
  value,
  min,
  max,
  zone,
  className,
}: {
  value: number;
  min: number;
  max: number;
  zone: SweetSpotZone;
  className?: string;
}) {
  // The track runs a quarter past the top of the sweet spot, so going over is
  // visible as overshoot rather than as a bar that simply stops being full.
  const scale = max * 1.25;
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;

  return (
    <Progress
      value={value}
      max={scale}
      aria-label="Chapter length"
      // Base UI hands the *formatted percentage* first and the raw value second.
      getAriaValueText={(_percent, words) =>
        `${formatNumber(words ?? 0)} words; sweet spot ${formatNumber(min)} to ${formatNumber(max)}`
      }
      className={cn("w-44 shrink-0", className)}
    >
      <ProgressTrack>
        <div
          aria-hidden
          className="absolute inset-y-0 bg-press/25"
          style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }}
        />
        <ProgressIndicator className={ZONE_FILL[zone]} />
      </ProgressTrack>
    </Progress>
  );
}

export { ZONE_TEXT, ZONE_FILL };
