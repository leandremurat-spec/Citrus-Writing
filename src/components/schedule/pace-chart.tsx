import { cn } from "@/lib/utils";
import type { PaceWeek } from "@/lib/data/schedule";

/** Words written per calendar week, last eight — the last bar is this week, still open. */
export function PaceChart({ weeks }: { weeks: PaceWeek[] }) {
  const max = Math.max(1, ...weeks.map((week) => week.words));

  return (
    <div aria-hidden className="flex h-[104px] items-end gap-2">
      {weeks.map((week, index) => (
        <span
          key={week.weekStart}
          className={cn(
            "flex-1 rounded-t-full rounded-b-md transition-[height] duration-surface ease-state",
            index === weeks.length - 1 ? "bg-ochre-600" : "bg-ochre-300",
          )}
          style={{ height: `${Math.max(3, (week.words / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
