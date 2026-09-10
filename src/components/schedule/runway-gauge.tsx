/** How many weeks of finished, queued work sit ahead of "now", against the target. */
export function RunwayGauge({ weeks, targetWeeks }: { weeks: number; targetWeeks: number }) {
  const max = Math.max(targetWeeks + 1, Math.ceil(weeks) + 1, 4);
  const fillPct = Math.min(100, (weeks / max) * 100);
  const targetPct = (targetWeeks / max) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label="Runway"
        aria-valuenow={Math.round(weeks * 10) / 10}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={`${weeks} of a target ${targetWeeks} weeks`}
        className="relative h-[22px] rounded-full bg-neutral-300"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-ochre-600 transition-[width] duration-surface ease-state"
          style={{ width: `${fillPct}%` }}
        />
        <div
          aria-hidden
          className="absolute top-[-7px] bottom-[-7px] w-[3px] rounded-full bg-press-800"
          style={{ left: `${targetPct}%` }}
        />
      </div>
      <div aria-hidden className="relative h-4 text-3xs text-subtle">
        <span className="absolute left-0">now</span>
        <span
          className="absolute -translate-x-1/2 font-bold text-press-800 whitespace-nowrap"
          style={{ left: `${targetPct}%` }}
        >
          target {targetWeeks}
        </span>
        <span className="absolute right-0">{max}</span>
      </div>
    </div>
  );
}
