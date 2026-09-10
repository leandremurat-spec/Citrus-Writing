import "server-only";

import { addWeeks, startOfWeek } from "date-fns";

import { ROOT, descendantChapters, type ChapterStatus } from "@/lib/binder/tree";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/data/writing";
import { isSlotDay, nextSlots, previousSlots, slotsPerWeek, type Cadence } from "@/lib/schedule/cadence";

import { getBinderNodes } from "./novels";

export async function getCadence(novelId: string): Promise<Cadence> {
  const novel = await prisma.novel.findUniqueOrThrow({
    where: { id: novelId },
    select: {
      cadenceFrequency: true,
      cadenceWeekdays: true,
      cadenceTime: true,
      cadenceTimeSecond: true,
      cadenceTargetWeeks: true,
      cadenceAnchor: true,
    },
  });
  return {
    frequency: novel.cadenceFrequency,
    weekdays: novel.cadenceWeekdays
      .split(",")
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    time: novel.cadenceTime,
    timeSecond: novel.cadenceTimeSecond,
    targetWeeks: novel.cadenceTargetWeeks,
    anchor: novel.cadenceAnchor,
  };
}

export interface ScheduleChapter {
  id: string;
  title: string;
  status: ChapterStatus;
  wordCount: number;
}

export interface ScheduleSlot {
  date: Date;
  chapter: ScheduleChapter | null;
}

export interface PaceWeek {
  weekStart: string;
  words: number;
}

export interface ScheduleBoard {
  cadence: Cadence;
  pastSlots: ScheduleSlot[];
  futureSlots: ScheduleSlot[];
  /** Consecutive filled future slots from "now", converted to weeks — the Runway gauge. */
  runwayWeeks: number;
  /** Finished-enough-to-schedule chapters with no date yet, in run order. */
  bench: ScheduleChapter[];
  /**
   * Chapters holding a date the cadence no longer releases on — changing the weekdays or the
   * frequency leaves them behind. They are shown with the date they still carry rather than
   * being cleared or quietly re-slotted: the date is the writer's plan, and this app does not
   * rewrite a plan without being asked. Before this existed they simply vanished from the
   * board and reappeared on the Bench under "drafts with no date yet", which was a lie.
   */
  offCadence: ScheduleSlot[];
  /** The last 8 calendar weeks (Monday-start), oldest first; the last entry is the current,
      still-open week. */
  paceWeeks: PaceWeek[];
  /** Average of the 7 *complete* weeks before this one — the still-open week would understate it. */
  averageWordsPerWeek: number;
  thisWeekWords: number;
}

const PAST_SLOTS = 2;
const FUTURE_SLOTS = 6;
const PACE_WEEKS = 8;

export async function toSlots(novelId: string, dates: Date[]): Promise<ScheduleSlot[]> {
  if (dates.length === 0) return [];
  const chapters = await prisma.chapter.findMany({
    where: { novelId, scheduledFor: { in: dates } },
    select: { id: true, title: true, status: true, wordCount: true, scheduledFor: true },
  });
  // Keyed on the exact moment, not the calendar day: a twice-daily cadence puts two slots on
  // one date, and matching by day would hand the same chapter to both of them.
  const byMoment = new Map(chapters.map((chapter) => [chapter.scheduledFor!.getTime(), chapter]));
  return dates.map((date) => ({ date, chapter: byMoment.get(date.getTime()) ?? null }));
}

export async function getScheduleBoard(novelId: string): Promise<ScheduleBoard> {
  const now = new Date();
  const cadence = await getCadence(novelId);

  const [pastSlots, futureSlots, nodes, paceRows, dated] = await Promise.all([
    toSlots(novelId, previousSlots(cadence, now, PAST_SLOTS)),
    toSlots(novelId, nextSlots(cadence, now, FUTURE_SLOTS)),
    getBinderNodes(novelId),
    prisma.novelDay.findMany({
      where: { novelId, day: { gte: dayKey(startOfWeek(addWeeks(now, -(PACE_WEEKS - 1)), { weekStartsOn: 1 })) } },
      select: { day: true, wordsWritten: true },
    }),
    // Every chapter that carries a date, not only the ones landing in the visible window —
    // which is what tells a stranded chapter apart from one that simply has no date.
    prisma.chapter.findMany({
      where: { novelId, scheduledFor: { not: null } },
      orderBy: { scheduledFor: "asc" },
      select: { id: true, title: true, status: true, wordCount: true, scheduledFor: true },
    }),
  ]);

  let runwayStreak = 0;
  for (const slot of futureSlots) {
    if (!slot.chapter) break;
    runwayStreak++;
  }
  const runwayWeeks = runwayStreak / slotsPerWeek(cadence.frequency);

  const offCadence: ScheduleSlot[] = dated
    .filter((chapter) => !isSlotDay(cadence, chapter.scheduledFor!))
    .map(({ scheduledFor, ...chapter }) => ({ date: scheduledFor!, chapter }));

  // A chapter with a date is never on the bench, even when that date is off the calendar or
  // too far out to be one of the slots above.
  const scheduledIds = new Set(dated.map((chapter) => chapter.id));
  const bench = descendantChapters(nodes, ROOT)
    .filter((chapter) => chapter.status !== "PUBLISHED" && !scheduledIds.has(chapter.id))
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      status: chapter.status ?? "DRAFT",
      wordCount: chapter.wordCount ?? 0,
    }));

  const weekBuckets = Array.from({ length: PACE_WEEKS }, (_, i) =>
    startOfWeek(addWeeks(now, -(PACE_WEEKS - 1 - i)), { weekStartsOn: 1 }),
  );
  const byDay = new Map(paceRows.map((row) => [row.day, row.wordsWritten]));
  const paceWeeks: PaceWeek[] = weekBuckets.map((weekStart) => {
    let words = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      words += byDay.get(dayKey(day)) ?? 0;
    }
    return { weekStart: dayKey(weekStart), words };
  });
  const completeWeeks = paceWeeks.slice(0, -1);
  const averageWordsPerWeek = completeWeeks.length
    ? Math.round(completeWeeks.reduce((sum, week) => sum + week.words, 0) / completeWeeks.length)
    : 0;

  return {
    cadence,
    pastSlots,
    futureSlots,
    runwayWeeks,
    bench,
    offCadence,
    paceWeeks,
    averageWordsPerWeek,
    thisWeekWords: paceWeeks[paceWeeks.length - 1]?.words ?? 0,
  };
}

export interface BufferSummary {
  runwayWeeks: number;
  targetWeeks: number;
  /** The next slot that already has a chapter in it, if any — "next out". */
  nextOutDate: Date | null;
}

const SUMMARY_SLOTS = 8;

/**
 * The one-line version of the board: what the Run band's chip and the Progress panel's Buffer
 * card show. Deliberately cheaper than `getScheduleBoard` — no pace history, no bench — since
 * this runs on every chapter page load rather than only when the Buffer itself is open.
 */
export async function getBufferSummary(novelId: string): Promise<BufferSummary> {
  const cadence = await getCadence(novelId);
  const upcoming = await toSlots(novelId, nextSlots(cadence, new Date(), SUMMARY_SLOTS));

  let runwayStreak = 0;
  for (const slot of upcoming) {
    if (!slot.chapter) break;
    runwayStreak++;
  }

  return {
    runwayWeeks: runwayStreak / slotsPerWeek(cadence.frequency),
    targetWeeks: cadence.targetWeeks,
    nextOutDate: upcoming.find((slot) => slot.chapter)?.date ?? null,
  };
}
