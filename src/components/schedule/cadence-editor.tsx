"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { updateCadence } from "@/lib/actions/schedule";
import { describeCadence, weekdaysNeeded, type Cadence, type CadenceFrequency } from "@/lib/schedule/cadence";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Slowest to fastest, so the row reads as a dial rather than a list. */
const FREQUENCIES: { value: CadenceFrequency; label: string }[] = [
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "TWICE_WEEKLY", label: "2× weekly" },
  { value: "THRICE_WEEKLY", label: "3× weekly" },
  { value: "DAILY", label: "Daily" },
  { value: "TWICE_DAILY", label: "2× daily" },
];

/** Sensible weekdays when a cadence starts asking for more of them than are currently picked. */
const DEFAULT_WEEKDAYS: Record<number, number[]> = { 1: [6], 2: [2, 6], 3: [1, 3, 5] };

/** The cadence bar: a read-only sentence with a "Change" button that opens this same row into
    an editing form, rather than a separate dialog — it's one fact about the novel, not a
    whole settings surface. */
export function CadenceEditor({ novelId, cadence }: { novelId: string; cadence: Cadence }) {
  const [editing, setEditing] = React.useState(false);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="font-heading text-xl text-ochre-900">Cadence</h2>
        <span className="text-sm text-ochre-800">{describeCadence(cadence)}</span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" className="border-ochre-600 text-ochre-900" onClick={() => setEditing(true)}>
          Change
        </Button>
      </div>
    );
  }

  return <CadenceForm novelId={novelId} cadence={cadence} onDone={() => setEditing(false)} />;
}

function CadenceForm({
  novelId,
  cadence,
  onDone,
}: {
  novelId: string;
  cadence: Cadence;
  onDone: () => void;
}) {
  const [frequency, setFrequency] = React.useState<CadenceFrequency>(cadence.frequency);
  const [weekdays, setWeekdays] = React.useState<number[]>(cadence.weekdays);
  const [time, setTime] = React.useState(cadence.time);
  const [timeSecond, setTimeSecond] = React.useState(cadence.timeSecond);
  const [targetWeeks, setTargetWeeks] = React.useState(cadence.targetWeeks);
  const [pending, startTransition] = React.useTransition();

  const needed = weekdaysNeeded(frequency);

  const changeFrequency = (next: CadenceFrequency) => {
    setFrequency(next);
    const wanted = weekdaysNeeded(next);
    // Keep what the writer already picked when the new cadence wants no more than that many,
    // so stepping Weekly → 2× weekly → Weekly does not silently forget their Saturday.
    setWeekdays(
      wanted === 0
        ? []
        : weekdays.length >= wanted
          ? weekdays.slice(0, wanted)
          : (DEFAULT_WEEKDAYS[wanted] ?? [6]),
    );
  };

  /**
   * Picking a day when the cadence is already full drops the oldest, so the control never
   * refuses a click — a writer changing Tuesday to Wednesday should not have to deselect first.
   */
  const toggleWeekday = (day: number) => {
    if (needed === 0) return;
    if (needed === 1) {
      setWeekdays([day]);
      return;
    }
    setWeekdays((previous) => {
      if (previous.includes(day)) return previous.length > 1 ? previous.filter((d) => d !== day) : previous;
      const next = previous.length < needed ? [...previous, day] : [...previous.slice(1), day];
      return next.sort((a, b) => a - b);
    });
  };

  const save = () => {
    startTransition(async () => {
      const response = await updateCadence({ novelId, frequency, weekdays, time, timeSecond, targetWeeks });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success("Schedule updated");
      onDone();
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="font-heading text-xl text-ochre-900">Cadence</h2>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 rounded-full bg-ochre-200 p-0.5">
          {FREQUENCIES.map((option) => {
            const active = option.value === frequency;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => changeFrequency(option.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-tint ease-state",
                  active ? "bg-ochre-700 text-ochre-100" : "text-ochre-900 hover:bg-ochre-100",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {needed > 0 && (
        <div className="flex gap-1">
          {WEEKDAY_LETTERS.map((letter, day) => {
            const active = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={
                  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
                }
                onClick={() => toggleWeekday(day)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors duration-tint ease-state",
                  active ? "bg-ochre-700 text-ochre-100" : "bg-ochre-200 text-ochre-900 hover:bg-ochre-300",
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
        )}

        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="focus-ring h-8 rounded-full bg-ochre-200 px-3 text-xs text-ochre-900"
          aria-label={frequency === "TWICE_DAILY" ? "First release time" : "Release time"}
        />

        {frequency === "TWICE_DAILY" && (
          <>
            <span className="text-xs text-ochre-800">and</span>
            <input
              type="time"
              value={timeSecond}
              onChange={(event) => setTimeSecond(event.target.value)}
              className="focus-ring h-8 rounded-full bg-ochre-200 px-3 text-xs text-ochre-900"
              aria-label="Second release time"
            />
          </>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ochre-800">Target</span>
          <div className="flex items-center gap-0.5 rounded-full bg-ochre-200 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Decrease target weeks"
              disabled={targetWeeks <= 1}
              onClick={() => setTargetWeeks((value) => Math.max(1, value - 1))}
            >
              <Minus />
            </Button>
            <span className="min-w-6 text-center text-xs font-medium text-ochre-900 tabular-nums">{targetWeeks}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Increase target weeks"
              disabled={targetWeeks >= 12}
              onClick={() => setTargetWeeks((value) => Math.min(12, value + 1))}
            >
              <Plus />
            </Button>
          </div>
          <span className="text-xs text-ochre-800">weeks</span>
        </div>

        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" className="text-ochre-800" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          Save
        </Button>
      </div>
    </div>
  );
}
