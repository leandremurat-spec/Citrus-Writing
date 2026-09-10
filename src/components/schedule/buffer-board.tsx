"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { queueNextOpenSlot, scheduleChapter, unscheduleChapter } from "@/lib/actions/schedule";
import { STATUS_META } from "@/lib/binder/status";
import type { ScheduleBoard, ScheduleChapter, ScheduleSlot } from "@/lib/data/schedule";
import { formatCompact, formatNumber, pluralize } from "@/lib/format";
import { describeCadence } from "@/lib/schedule/cadence";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/binder/status-badge";
import { Button } from "@/components/ui/button";

import { CadenceEditor } from "./cadence-editor";
import { PaceChart } from "./pace-chart";
import { RunwayGauge } from "./runway-gauge";

function formatWeeks(weeks: number): string {
  const rounded = Math.round(weeks * 10) / 10;
  return `${rounded} ${rounded === 1 ? "week" : "weeks"}`;
}

/**
 * The Buffer: the release schedule. Replaces the run band and the Command Centre the same way
 * the Codex does — this is a planning surface, not something a writer needs beside the
 * manuscript, so it gets the whole width instead of squeezing into a side panel.
 */
export function BufferBoard({
  novelId,
  novelTitle,
  board,
}: {
  novelId: string;
  novelTitle: string;
  board: ScheduleBoard;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const response = await scheduleChapter({ chapterId: String(active.id), date: new Date(String(over.id)) });
    if (!response.ok) toast.error(response.error);
  };

  const handleQueueNext = async (chapterId: string) => {
    const response = await queueNextOpenSlot({ novelId, chapterId });
    if (!response.ok) toast.error(response.error);
  };

  const handleUnschedule = async (chapterId: string) => {
    const response = await unscheduleChapter({ chapterId });
    if (!response.ok) toast.error(response.error);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-[68rem] px-10 py-8">
        <p className="label-eyebrow mb-2">{novelTitle} · release schedule</p>
        <h1 className="font-heading text-4xl">The Buffer</h1>
        <p className="mt-3 max-w-[44rem] font-serif text-lg leading-relaxed text-foreground/85">
          {board.runwayWeeks > 0 ? (
            <>You are <strong>{formatWeeks(board.runwayWeeks)} ahead</strong>. </>
          ) : (
            "Nothing queued yet. "
          )}
          {describeCadence(board.cadence)}
        </p>

        <div className="mt-6 rounded-[1.75rem] bg-card p-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-heading text-2xl">Runway</h2>
            <span className="flex-1" />
            <span className="font-heading text-2xl whitespace-nowrap text-ochre-800">
              {formatWeeks(board.runwayWeeks)}{" "}
              <span className="font-sans text-sm font-semibold text-muted-foreground">
                of {board.cadence.targetWeeks}
              </span>
            </span>
          </div>
          <div className="mt-4">
            <RunwayGauge weeks={board.runwayWeeks} targetWeeks={board.cadence.targetWeeks} />
          </div>
        </div>

        <DndContext id="buffer-dnd" sensors={sensors} onDragEnd={(event) => void handleDragEnd(event)}>
          <h2 className="mt-9 mb-1 font-heading text-2xl">
            The next {pluralize(board.futureSlots.length, "release date")}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Drag a chapter onto a date to queue it.</p>

          <div className="flex gap-3 overflow-x-auto pb-3.5">
            {board.pastSlots.map((slot) => (
              <PastSlotCard key={slot.date.toISOString()} slot={slot} />
            ))}
            <NowMarker />
            {board.futureSlots.map((slot) => (
              <FutureSlotCard key={slot.date.toISOString()} slot={slot} onUnschedule={(id) => void handleUnschedule(id)} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-start gap-4">
            <div className="min-w-[320px] flex-1 rounded-[1.75rem] bg-card p-6">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-heading text-xl">The bench</h2>
                <span className="text-xs text-muted-foreground">no date yet</span>
              </div>
              <div className="mt-3.5 flex flex-col gap-2">
                {board.bench.length === 0 ? (
                  <p className="text-sm text-subtle">Nothing waiting.</p>
                ) : (
                  board.bench.map((chapter) => (
                    <BenchCard key={chapter.id} chapter={chapter} onQueue={() => void handleQueueNext(chapter.id)} />
                  ))
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                A chapter can only be queued once it is Edited.
              </p>

              {board.offCadence.length > 0 && (
                <div className="mt-5 border-t border-divider pt-4">
                  <div className="flex items-baseline gap-2.5">
                    <h3 className="font-heading text-lg">Off the calendar</h3>
                      </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {board.offCadence.map((slot) => (
                      <StrandedCard
                        key={slot.chapter!.id}
                        chapter={slot.chapter!}
                        date={slot.date}
                        onQueue={() => void handleQueueNext(slot.chapter!.id)}
                        onUnschedule={() => void handleUnschedule(slot.chapter!.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-[260px] flex-1 rounded-[1.75rem] bg-card p-6">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-heading text-xl">Pace</h2>
                <span className="text-xs text-muted-foreground">last eight weeks</span>
              </div>
              <div className="mt-3.5">
                <PaceChart weeks={board.paceWeeks} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                <strong className="font-heading text-xl">{formatNumber(board.averageWordsPerWeek)}</strong> words a
                week on average.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This week is still open: {formatNumber(board.thisWeekWords)} so far.
              </p>
            </div>
          </div>
        </DndContext>

        <div className="mt-4 rounded-[1.75rem] bg-ochre-100 p-6">
          <CadenceEditor novelId={novelId} cadence={board.cadence} />
          <p className="mt-3 text-xs text-ochre-800">Nothing here posts for you — this measures the buffer.</p>
        </div>
      </div>
    </div>
  );
}

function PastSlotCard({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className="flex w-[168px] shrink-0 flex-col gap-2">
      <p className="label-eyebrow">{format(slot.date, "EEE d MMM")}</p>
      <div className="flex min-h-[108px] flex-col gap-2 rounded-[1.375rem] bg-neutral-200 p-3.5">
        {slot.chapter ? (
          <>
            <span className="flex items-center gap-1.5 text-3xs font-bold text-neutral-800">
              <span className="size-2.5 rounded-full bg-press" aria-hidden /> OUT
            </span>
            <p className="text-sm leading-snug font-medium">{slot.chapter.title}</p>
            <p className="text-2xs text-subtle">{formatCompact(slot.chapter.wordCount)} words</p>
          </>
        ) : (
          <p className="text-2xs text-subtle">Nothing went out.</p>
        )}
      </div>
    </div>
  );
}

function NowMarker() {
  return (
    <div aria-hidden className="flex w-6 shrink-0 flex-col items-center gap-2">
      <p className="h-4 text-3xs font-bold whitespace-nowrap text-ochre-800">now</p>
      <span className="w-0 flex-1 border-l-2 border-dashed border-ochre-600" />
    </div>
  );
}

function FutureSlotCard({
  slot,
  onUnschedule,
}: {
  slot: ScheduleSlot;
  onUnschedule: (chapterId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.date.toISOString(), disabled: Boolean(slot.chapter) });

  return (
    <div className="flex w-[168px] shrink-0 flex-col gap-2">
      <p className={cn("label-eyebrow", slot.chapter && "text-press-700")}>{format(slot.date, "EEE d MMM")}</p>
      {slot.chapter ? (
        <div className="group/slot relative flex min-h-[108px] flex-col gap-2 rounded-[1.375rem] bg-press-100 p-3.5 shadow-e0">
          <span className="flex items-center gap-1.5 text-3xs font-bold text-press-800">
            <StatusDot status={slot.chapter.status} /> {STATUS_META[slot.chapter.status].label.toUpperCase()}
          </span>
          <p className="text-sm leading-snug font-medium text-press-900">{slot.chapter.title}</p>
          <p className="text-2xs text-press-800">{formatCompact(slot.chapter.wordCount)} words</p>
          <button
            type="button"
            aria-label={`Remove ${slot.chapter.title} from this date`}
            onClick={() => onUnschedule(slot.chapter!.id)}
            className="focus-ring absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-press-700 opacity-0 transition-opacity duration-tint ease-state group-hover/slot:opacity-100 hover:bg-press-200"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[108px] flex-col items-center justify-center gap-1.5 rounded-[1.375rem] border-2 border-dashed text-2xs text-subtle transition-colors duration-tint ease-state",
            isOver ? "border-press bg-press-100 text-press-800" : "border-neutral-600",
          )}
        >
          <Plus className="size-4" aria-hidden />
          Drop a chapter here
        </div>
      )}
    </div>
  );
}

/**
 * A chapter still holding a date the cadence no longer releases on — what changing the
 * weekdays or the frequency leaves behind. It is not draggable: it already has a date, and
 * the two ways out of that are moving it to a real slot or clearing it, both offered here.
 */
function StrandedCard({
  chapter,
  date,
  onQueue,
  onUnschedule,
}: {
  chapter: ScheduleChapter;
  date: Date;
  onQueue: () => void;
  onUnschedule: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] bg-muted px-3.5 py-3">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <StatusDot status={chapter.status} />
          <span className="truncate text-sm font-medium">{chapter.title}</span>
        </span>
        <span className="block pl-3.5 text-2xs text-subtle">
          was set for {format(date, "EEE d MMM")} · {formatCompact(chapter.wordCount)} words
        </span>
      </span>
      <Button type="button" variant="secondary" size="xs" className="shrink-0" onClick={onQueue}>
        Move
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="shrink-0 text-subtle"
        aria-label={`Clear the date on ${chapter.title}`}
        onClick={onUnschedule}
      >
        Clear
      </Button>
    </div>
  );
}

function BenchCard({ chapter, onQueue }: { chapter: ScheduleChapter; onQueue: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: chapter.id });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-3 rounded-[1.25rem] bg-muted px-3.5 py-3 outline-none active:cursor-grabbing",
        isDragging && "opacity-50 shadow-e2",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <StatusDot status={chapter.status} />
          <span className="truncate text-sm font-medium">{chapter.title}</span>
        </span>
        <span className="block pl-3.5 text-2xs text-subtle">{formatCompact(chapter.wordCount)} words</span>
      </span>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        className="shrink-0"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onQueue();
        }}
        disabled={chapter.status === "DRAFT"}
      >
        Queue
      </Button>
    </div>
  );
}
