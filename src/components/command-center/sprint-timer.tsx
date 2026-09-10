"use client";

import * as React from "react";
import { Square, Timer } from "lucide-react";
import { toast } from "sonner";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Surface } from "@/components/ui/surface";
import { finishSprint, startSprint, stopSprint, useNow, useSprint } from "@/components/workspace/sprint-store";

const PRESETS = [
  { minutes: 10, target: 300 },
  { minutes: 15, target: 500 },
  { minutes: 25, target: 800 },
] as const;

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * A word sprint: a countdown with a word target.
 *
 * Serial writers work in sprints, and this is the one feature in the panel that changes how
 * the session goes rather than reporting on it. It measures net words for the day, so
 * deleting during a sprint honestly costs you.
 */
export function SprintTimer({ todayWords }: { todayWords: number }) {
  const sprint = useSprint();
  const running = Boolean(sprint && !sprint.done);
  const now = useNow(running);
  const remaining = sprint ? sprint.endsAt - now : 0;
  const written = sprint ? Math.max(0, todayWords - sprint.startedAtWords) : 0;

  // The end is a timestamp, so "over" is a comparison rather than a timer that must survive
  // being throttled in a background tab.
  const over = running && remaining <= 0;
  React.useEffect(() => {
    if (!over || !sprint) return;
    finishSprint();
    toast.success(`Sprint done — ${formatNumber(written)} words in ${sprint.minutes} minutes.`, {
      description: written >= sprint.target ? "Target hit." : `Target was ${formatNumber(sprint.target)}.`,
    });
  }, [over, sprint, written]);

  if (!sprint) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1.5 text-2xs text-subtle">
          <Timer className="size-3.5" aria-hidden /> Sprint
        </span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.minutes}
            variant="outline"
            size="xs"
            onClick={() => startSprint(preset.minutes, preset.target, todayWords)}
          >
            {preset.minutes} min
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Surface className="p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-2xl leading-none font-semibold tabular-nums">
          {sprint.done ? "Done" : clock(remaining)}
        </span>
        <span className="text-2xs text-subtle tabular-nums">
          {formatNumber(written)} / {formatNumber(sprint.target)} words
        </span>
      </div>

      <Progress
        value={Math.min(written, sprint.target)}
        max={sprint.target}
        aria-label="Sprint progress"
        getAriaValueText={(_percent, words) => `${formatNumber(words ?? 0)} of ${formatNumber(sprint.target)} words`}
        className="mt-2 block"
      >
        <ProgressTrack>
          <ProgressIndicator className={cn(written >= sprint.target ? "bg-press" : "bg-ochre/80")} />
        </ProgressTrack>
      </Progress>

      <Button variant="ghost" size="xs" className="mt-2 text-subtle" onClick={stopSprint}>
        <Square /> {sprint.done ? "Clear" : "Stop"}
      </Button>
    </Surface>
  );
}
