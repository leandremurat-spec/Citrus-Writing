import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCadence, getScheduleBoard } from "@/lib/data/schedule";
import { dayKey } from "@/lib/data/writing";
import { slotsPerWeek } from "@/lib/schedule/cadence";

/**
 * What a writer's own numbers say about their working week.
 *
 * ── Why this is mostly assembly ───────────────────────────────────────────────
 *
 * Almost none of this is new arithmetic. `getScheduleBoard` already computes runway and an
 * eight-week pace per novel; `WritingSession` already holds one row per writer per day across
 * every novel. What was missing was a place that reads them *together* — the Buffer answers
 * "how is this serial doing", and nothing answered "how am I doing", which is the question a
 * writer with two serials actually has.
 *
 * ── The projection, and why it is stated as a date ────────────────────────────
 *
 * A buffer is a race between two rates: chapters finished per week, against chapters published
 * per week. `slotsPerWeek` gives the second exactly. The first is derived — average words a week
 * divided by the average length of the chapters already written — and is the soft number here,
 * so it is treated as soft: the projection is withheld entirely below a fortnight of history,
 * because two data points make a line through anything.
 *
 * A date rather than a rate because "0.4 chapters a week ahead" is arithmetic a writer has to
 * finish themselves, and "the 14th of November" is an answer. The same reason the Buffer says
 * weeks of runway rather than a count of scheduled chapters.
 */

// Same shape the other data modules take, so a caller inside a transaction can pass one.
type Db = Prisma.TransactionClient;

/** Days of history the daily chart and the weekday breakdown read. */
const HISTORY_DAYS = 84;

/** Below this, a pace is noise and any projection from it is a guess wearing a date. */
const MIN_DAYS_FOR_PROJECTION = 14;

export interface DailyWord {
  /** "YYYY-MM-DD". */
  day: string;
  words: number;
  goalMet: boolean;
}

export interface WeekdayAverage {
  /** 0 = Sunday, matching `Date.getDay()`. */
  weekday: number;
  averageWords: number;
  /** Days with any words, out of days observed — how often this weekday is a writing day. */
  hitRate: number;
}

export interface SerialPace {
  novelId: string;
  title: string;
  /** Weeks of consecutive filled future slots, as the Buffer counts them. */
  runwayWeeks: number;
  targetWeeks: number;
  /** Releases a week at the current cadence. */
  releasesPerWeek: number;
  averageWordsPerWeek: number;
  /** Mean length of the chapters that already exist — what a "chapter" costs this writer. */
  averageChapterWords: number;
  /**
   * Chapters finished per week minus chapters published per week. Negative means the buffer is
   * draining, which is the number worth knowing before the runway reaches zero.
   */
  netChaptersPerWeek: number;
  /** When the target runway is reached at this rate. Null when it never is, or is already met. */
  reachesTargetOn: string | null;
  /** When the buffer empties at this rate. Null unless it is actually draining. */
  emptiesOn: string | null;
}

export interface Insights {
  /** Oldest first, one entry per day with any record. */
  daily: DailyWord[];
  weekdays: WeekdayAverage[];
  /** Days with any words, out of the days observed. */
  consistency: number;
  /** Best single day in the window. */
  bestDay: DailyWord | null;
  totalWords: number;
  daysObserved: number;
  averageWordsPerWritingDay: number;
  /** Null when there is too little history to say anything honest. */
  serials: SerialPace[] | null;
  hasEnoughHistory: boolean;
}

function addWeeks(from: Date, weeks: number): string {
  const date = new Date(from);
  date.setDate(date.getDate() + Math.ceil(weeks * 7));
  return dayKey(date);
}

/**
 * Everything the insights page shows.
 *
 * `serials` is null rather than empty when there is too little history: an empty list says "you
 * have no serials", and a null says "ask again in a week", which are different answers to
 * different questions.
 */
export async function getInsights(userId: string, db: Db = prisma): Promise<Insights> {
  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);

  const [sessions, novels] = await Promise.all([
    db.writingSession.findMany({
      where: { userId, day: { gte: dayKey(since) } },
      orderBy: { day: "asc" },
      select: { day: true, wordsWritten: true, goalMet: true },
    }),
    db.novel.findMany({ where: { userId }, select: { id: true, title: true } }),
  ]);

  const daily: DailyWord[] = sessions.map((s) => ({ day: s.day, words: s.wordsWritten, goalMet: s.goalMet }));
  const writingDays = daily.filter((d) => d.words > 0);
  const totalWords = daily.reduce((sum, d) => sum + d.words, 0);

  /*
   * Weekday averages are taken over the days *observed*, not over fourteen fixed buckets. A
   * writer three weeks in has three Mondays, and dividing their Monday total by twelve would
   * report a habit they do not have.
   */
  const buckets = new Map<number, { total: number; days: number; wrote: number }>();
  for (const entry of daily) {
    // Parsed as UTC noon: a bare "YYYY-MM-DD" is UTC midnight, which is the previous day in
    // every timezone west of Greenwich, and would shift every weekday by one.
    const weekday = new Date(entry.day + "T12:00:00Z").getUTCDay();
    const bucket = buckets.get(weekday) ?? { total: 0, days: 0, wrote: 0 };
    bucket.total += entry.words;
    bucket.days += 1;
    if (entry.words > 0) bucket.wrote += 1;
    buckets.set(weekday, bucket);
  }

  const weekdays: WeekdayAverage[] = Array.from({ length: 7 }, (_, weekday) => {
    const bucket = buckets.get(weekday);
    if (!bucket || bucket.days === 0) return { weekday, averageWords: 0, hitRate: 0 };
    return {
      weekday,
      averageWords: Math.round(bucket.total / bucket.days),
      hitRate: bucket.wrote / bucket.days,
    };
  });

  const hasEnoughHistory = daily.length >= MIN_DAYS_FOR_PROJECTION;

  let serials: SerialPace[] | null = null;
  if (hasEnoughHistory && novels.length > 0) {
    serials = await Promise.all(
      novels.map(async (novel) => {
        const [board, cadence, chapters] = await Promise.all([
          getScheduleBoard(novel.id),
          getCadence(novel.id),
          db.chapter.findMany({ where: { novelId: novel.id }, select: { wordCount: true } }),
        ]);

        const written = chapters.filter((c) => c.wordCount > 0);
        const averageChapterWords = written.length
          ? Math.round(written.reduce((sum, c) => sum + c.wordCount, 0) / written.length)
          : 0;

        const releasesPerWeek = slotsPerWeek(cadence.frequency);
        const chaptersPerWeek = averageChapterWords > 0 ? board.averageWordsPerWeek / averageChapterWords : 0;
        const netChaptersPerWeek = chaptersPerWeek - releasesPerWeek;

        const targetWeeks = cadence.targetWeeks;
        const now = new Date();

        // Both projections are the same division, in opposite directions, and both are only
        // meaningful when the rate has the right sign.
        const weeksShort = targetWeeks - board.runwayWeeks;
        const reachesTargetOn =
          weeksShort > 0 && netChaptersPerWeek > 0
            ? addWeeks(now, (weeksShort * releasesPerWeek) / netChaptersPerWeek)
            : null;

        const emptiesOn =
          netChaptersPerWeek < 0 && board.runwayWeeks > 0
            ? addWeeks(now, (board.runwayWeeks * releasesPerWeek) / -netChaptersPerWeek)
            : null;

        return {
          novelId: novel.id,
          title: novel.title,
          runwayWeeks: board.runwayWeeks,
          targetWeeks,
          releasesPerWeek,
          averageWordsPerWeek: board.averageWordsPerWeek,
          averageChapterWords,
          netChaptersPerWeek,
          reachesTargetOn,
          emptiesOn,
        };
      }),
    );
  }

  return {
    daily,
    weekdays,
    consistency: daily.length ? writingDays.length / daily.length : 0,
    bestDay: writingDays.reduce<DailyWord | null>((best, d) => (!best || d.words > best.words ? d : best), null),
    totalWords,
    daysObserved: daily.length,
    averageWordsPerWritingDay: writingDays.length ? Math.round(totalWords / writingDays.length) : 0,
    serials,
    hasEnoughHistory,
  };
}
