"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Check, Flame } from "lucide-react";

import { getGoalState } from "@/lib/editor/goal-message";
import { getSweetSpotState } from "@/lib/editor/sweet-spot";
import { formatSigned } from "@/lib/editor/word-diff";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BufferSummary } from "@/lib/data/schedule";
import type { WeekDay } from "@/lib/data/writing";
import { ZONE_TEXT } from "@/components/canvas/status-bar";
import { ChapterGauge } from "@/components/command-center/page-gauge";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { SprintTimer } from "./sprint-timer";
import { useWritingStatus, type WritingStatus } from "@/components/workspace/live-chapter";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The Progress tab: everything the old cramped footer used to hide at narrow widths, with
 * room to actually read it. Values come from the editor through the live store, so they move
 * as you type even though the editor lives in a different route slot.
 */
export function ProgressPanel({
  chapterId,
  fallback,
  weekDays,
  novelId,
  bufferSummary,
}: {
  chapterId: string | null;
  /** Server-rendered figures, shown until the editor reports its first update. */
  fallback: WritingStatus | null;
  /** This calendar week, Monday first, for the streak's day-dots. */
  weekDays: WeekDay[];
  novelId?: string;
  bufferSummary?: BufferSummary;
}) {
  const live = useWritingStatus(chapterId);
  const status = live ?? fallback;

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Open a chapter.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <ChapterProgress status={status} chapterId={chapterId ?? ""} />
      <Sitting status={status} />
      <Today status={status} weekDays={weekDays} />
      {novelId && bufferSummary && <BufferCard novelId={novelId} summary={bufferSummary} />}

      <Section title="Sprint">
        <SprintTimer todayWords={status.todayWords} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="label-section mb-2">{title}</h3>
      {children}
    </section>
  );
}

function ChapterProgress({ status, chapterId }: { status: WritingStatus; chapterId: string }) {
  // Seeded per chapter so the encouraging message doesn't reshuffle on every keystroke.
  const seed = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < chapterId.length; i++) hash = (hash * 31 + chapterId.charCodeAt(i)) | 0;
    return hash;
  }, [chapterId]);
  const spot = getSweetSpotState(status.wordCount, status.sweetSpotMin, status.sweetSpotMax, seed);

  return (
    <Section title="This chapter">
      <div className="flex gap-4">
        <ChapterGauge
          value={status.wordCount}
          min={status.sweetSpotMin}
          max={status.sweetSpotMax}
          zone={spot.zone}
          className="w-[4.5rem] shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl leading-none font-semibold text-foreground tabular-nums">
              {formatNumber(status.wordCount)}
            </span>
            <span className="text-xs text-muted-foreground">words</span>
          </p>
          <p className="mt-1 text-2xs text-subtle">
            Sweet spot {formatNumber(status.sweetSpotMin)}–{formatNumber(status.sweetSpotMax)}
          </p>
          <p
            key={spot.zone}
            className={cn(
              "mt-2.5 text-xs leading-relaxed duration-surface ease-out-quiet animate-in fade-in",
              ZONE_TEXT[spot.zone],
            )}
          >
            {spot.message}
          </p>
        </div>
      </div>
    </Section>
  );
}

function Sitting({ status }: { status: WritingStatus }) {
  const net = status.sittingAdded - status.sittingRemoved;
  const touched = status.sittingAdded > 0 || status.sittingRemoved > 0;

  return (
    <Section title="This sitting">
      {touched ? (
        <DiffRow added={status.sittingAdded} removed={status.sittingRemoved} net={net} />
      ) : (
        <p className="text-xs text-subtle">Nothing yet.</p>
      )}
    </Section>
  );
}

/**
 * Two scopes on one panel, and they are labelled because they genuinely differ: the figures
 * are this novel's, the goal and the streak are the writer's across every novel. Before this
 * the day's counts carried between books, which made "today" mean nothing in either.
 */
function Today({ status, weekDays }: { status: WritingStatus; weekDays: WeekDay[] }) {
  const net = status.novelAdded - status.novelRemoved;
  const goalMet = status.todayWords >= status.dailyGoal;
  // Seeded by the day, so the line holds still while you type but is different tomorrow.
  const goal = getGoalState(status.todayWords, status.dailyGoal, new Date().getDate());

  return (
    <Section title="This story, today">
      <div className="flex flex-col gap-3">
        <DiffRow added={status.novelAdded} removed={status.novelRemoved} net={net} />

        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="flex items-baseline gap-1.5 text-muted-foreground">
              Daily goal
              <span className="text-3xs text-subtle">all stories</span>
            </span>
            <span className={cn("tabular-nums", goalMet ? "text-press" : "text-foreground")}>
              {formatNumber(status.todayWords)}
              <span className="text-muted-foreground"> / {formatNumber(status.dailyGoal)}</span>
            </span>
          </div>
          <Progress
            value={status.todayWords}
            max={status.dailyGoal}
            aria-label="Daily goal"
            getAriaValueText={(_percent, words) => `${formatNumber(words ?? 0)} of ${formatNumber(status.dailyGoal)} words`}
            className="mt-1.5 block"
          >
            <ProgressTrack>
              <ProgressIndicator className={goalMet ? "bg-press" : "bg-ochre/80"} />
            </ProgressTrack>
          </Progress>
          {/*
            The encouragement lives here now, under the number it is encouraging about, and it
            changes when the goal is crossed instead of still cheering you towards it.
          */}
          <p
            key={goal.zone}
            className={cn(
              "mt-2 flex items-start gap-1.5 text-2xs leading-relaxed duration-surface ease-out-quiet animate-in fade-in",
              goalMet ? "text-press" : "text-subtle",
            )}
            aria-live="polite"
          >
            {goalMet && <Check className="mt-px size-3 shrink-0" aria-hidden />}
            {goal.message}
          </p>
        </div>

        {weekDays.length > 0 && <WeekDots weekDays={weekDays} />}

        <p className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
          <Flame
            className={cn("size-3.5 shrink-0 self-center", status.streakAlive ? "text-ochre" : "text-subtle")}
            aria-hidden
          />
          <span className="text-foreground tabular-nums">
            {status.streak > 0 ? `${status.streak}-day streak` : "No streak yet"}
          </span>
          <span className="text-subtle">
            {status.streakAlive
              ? "· today counts"
              : status.streak > 0
                ? "· write today to keep it"
                : "· write today to start one"}
          </span>
        </p>
      </div>
    </Section>
  );
}

/** A short summary of the release schedule, and the door to the full Buffer board. */
function BufferCard({ novelId, summary }: { novelId: string; summary: BufferSummary }) {
  const weeks = Math.round(summary.runwayWeeks * 10) / 10;
  return (
    <Link
      href={`/novels/${novelId}/buffer`}
      className="focus-ring flex flex-col gap-1.5 rounded-lg bg-ochre-100 p-4 transition-colors duration-tint ease-state hover:bg-ochre-200"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-heading text-lg text-ochre-900">The buffer</h4>
        <span className="text-2xs whitespace-nowrap text-ochre-800">
          {summary.nextOutDate ? `next out ${format(summary.nextOutDate, "EEEE")}` : "nothing queued"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ochre-800">
        {weeks > 0 ? (
          <>
            <strong>
              {weeks} {weeks === 1 ? "week" : "weeks"}
            </strong>{" "}
            of runway toward a {summary.targetWeeks}-week target.
          </>
        ) : (
          "Nothing queued yet — open the schedule to plan ahead."
        )}
      </p>
      <span className="mt-0.5 text-xs font-medium text-ochre-800">Open the schedule →</span>
    </Link>
  );
}

/** This calendar week, Monday first. A filled dot is a day with net words written; today
    stands out with a ring; days that have not happened yet are hollow placeholders. */
export function WeekDots({ weekDays }: { weekDays: WeekDay[] }) {
  return (
    <div className="flex items-end justify-between gap-1">
      {weekDays.map((day, index) => (
        <div key={day.day} className="flex flex-col items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "rounded-full",
              day.isToday
                ? "size-[22px] bg-ochre-600 shadow-[0_0_0_3px_var(--ochre-200)]"
                : day.isFuture
                  ? "size-[18px] ring-[1.5px] ring-neutral-600"
                  : day.wordsWritten > 0
                    ? "size-[18px] bg-ochre-500"
                    : "size-[18px] ring-[1.5px] ring-neutral-600",
            )}
          />
          <span className={cn("text-3xs", day.isToday ? "font-bold text-ochre-800" : "text-subtle")}>
            {WEEKDAY_LETTERS[index]}
          </span>
        </div>
      ))}
    </div>
  );
}

/*
 * Written and cut, as a sentence.
 *
 * This was three bordered tiles reading "+43 / −43 / 0" — a metrics widget sitting beside
 * someone's novel. The numbers are the same; what changed is that they are now read rather
 * than scanned, which is the difference between a dashboard and a margin note.
 */
function DiffRow({ added, removed, net }: { added: number; removed: number; net: number }) {
  if (added === 0 && removed === 0) {
    return <p className="text-xs text-subtle">Nothing yet.</p>;
  }

  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-semibold text-press tabular-nums">{formatNumber(added)}</span> written
      {removed > 0 && (
        <>
          , <span className="font-semibold text-foreground tabular-nums">{formatNumber(removed)}</span> cut
        </>
      )}
      {removed > 0 && (
        <span className="text-subtle">
          {" "}
          · {formatSigned(net)} on the page
        </span>
      )}
      .
    </p>
  );
}
