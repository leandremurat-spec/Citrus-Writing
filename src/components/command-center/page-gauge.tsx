"use client";

import type { SweetSpotZone } from "@/lib/editor/sweet-spot";
import { cn } from "@/lib/utils";

/*
 * A chapter's length, drawn as a ring filling in — replacing the earlier ruled-page metaphor
 * (see CLAUDE.md, "Superseded") with the circular gauge from the Citrus Writing handoff. The
 * sweet-spot band is a second, lighter arc laid down first so the progress arc is read against
 * it, the same relationship the footer's linear bar already draws.
 *
 * Still a real `progressbar` to anything that cannot see it — the ring is for the eye, the
 * numbers are for the screen reader.
 */

const RADIUS = 48;
const STROKE = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ZONE_RING: Record<SweetSpotZone, string> = {
  empty: "stroke-subtle",
  warming: "stroke-ochre-500",
  building: "stroke-ochre-600",
  close: "stroke-ochre-700",
  sweet: "stroke-press",
  over: "stroke-proof",
  "far-over": "stroke-proof",
};

export function ChapterGauge({
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
  // The ring runs a quarter past the top of the sweet spot, so overshoot shows as a ring that
  // has visibly gone all the way round rather than one that simply stops filling.
  const scale = max * 1.25;
  const progressFrac = Math.min(1, value / scale);
  const bandFromFrac = min / scale;
  const bandToFrac = Math.min(1, max / scale);

  return (
    <div
      className={cn("relative", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={scale}
      aria-valuetext={`${value} words; sweet spot ${min} to ${max}`}
      aria-label="Chapter length"
    >
      <svg viewBox="0 0 116 116" className="block w-full" aria-hidden>
        <circle cx={58} cy={58} r={RADIUS} strokeWidth={STROKE} className="fill-none stroke-neutral-300" />
        <circle
          cx={58}
          cy={58}
          r={RADIUS}
          strokeWidth={STROKE}
          className="fill-none stroke-ochre-300"
          strokeDasharray={`${(bandToFrac - bandFromFrac) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={-bandFromFrac * CIRCUMFERENCE}
          transform="rotate(-90 58 58)"
        />
        <circle
          cx={58}
          cy={58}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeLinecap="round"
          className={cn("fill-none transition-[stroke-dasharray] duration-surface ease-state", ZONE_RING[zone])}
          strokeDasharray={`${progressFrac * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          transform="rotate(-90 58 58)"
        />
      </svg>
    </div>
  );
}
