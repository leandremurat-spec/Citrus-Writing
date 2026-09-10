import "server-only";

import { addDays, format, startOfWeek, subDays } from "date-fns";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Daily writing sessions and streaks.
 *
 * Rules the user chose: a day counts toward the streak when its net words are positive
 * (deletions subtract, floored at zero for the day); the daily goal is separate and optional.
 * Alongside that running net, each day also keeps gross words added and removed, so an
 * editing day can show "+120 −340" even though its floored net is zero.
 * Days are the machine's local calendar days, stored as "YYYY-MM-DD".
 *
 * Three scopes now, not two. Everything below is first scoped to one *writer* — a streak is
 * personal, and two accounts sharing a day row would have shared a streak. Within that:
 *
 * Two scopes, deliberately. The *counts* are per novel — a chapter's story is the only thing
 * "today" means anything about, and word counts carrying between books was a real bug. The
 * *goal and the streak* are per writer and sum across every story: 600 words in one novel and
 * 500 in another is a thousand-word day and should keep the streak alive.
 */

export interface WritingSummary {
  /** Running net words written today in *this novel*, floored at zero. */
  novelWords: number;
  /** Gross words added today in this novel. */
  novelAdded: number;
  /** Gross words removed today in this novel. */
  novelRemoved: number;
  /** Running net words today across every novel, floored at zero. Drives goal and streak. */
  todayWords: number;
  /** Gross words added today across every novel. */
  todayAdded: number;
  /** Gross words removed today across every novel. */
  todayRemoved: number;
  /** Consecutive writing days ending today, or ending yesterday if today has no words yet. */
  streak: number;
  /** What the streak becomes once today's first net word lands. */
  streakIfWriteToday: number;
  dailyGoal: number;
  goalMet: boolean;
}

/** What one save contributed: the change in the chapter's word count plus the gross diff. */
export interface WritingDelta {
  delta: number;
  added: number;
  removed: number;
}

type Db = Prisma.TransactionClient;

interface SessionRow {
  wordsWritten: number;
  wordsAdded: number;
  wordsRemoved: number;
  streakCount: number;
}

/** The same three figures, scoped to one novel. No streak: streaks are personal. */
interface NovelDayRow {
  wordsWritten: number;
  wordsAdded: number;
  wordsRemoved: number;
}

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function streakFor(words: number, yesterday: SessionRow | null): number {
  if (words <= 0) return 0;
  return yesterday && yesterday.wordsWritten > 0 ? yesterday.streakCount + 1 : 1;
}

async function loadDays(db: Db, userId: string, novelId: string | null) {
  const now = new Date();
  // Sequential on purpose: interactive transactions expect one query at a time.
  const settings = await db.authorSettings.upsert({ where: { userId }, update: {}, create: { userId } });
  const today = await db.writingSession.findUnique({ where: { userId_day: { userId, day: dayKey(now) } } });
  const yesterday = await db.writingSession.findUnique({
    where: { userId_day: { userId, day: dayKey(subDays(now, 1)) } },
  });
  const novelToday = novelId
    ? await db.novelDay.findUnique({ where: { novelId_day: { novelId, day: dayKey(now) } } })
    : null;
  return { now, settings, today, yesterday, novelToday };
}

function summarize(
  today: SessionRow | null,
  yesterday: SessionRow | null,
  dailyGoal: number,
  novelToday: NovelDayRow | null,
): WritingSummary {
  const todayWords = today?.wordsWritten ?? 0;
  const todayStreak = today?.streakCount ?? streakFor(todayWords, yesterday);
  const carried = yesterday && yesterday.wordsWritten > 0 ? yesterday.streakCount : 0;
  return {
    novelWords: novelToday?.wordsWritten ?? 0,
    novelAdded: novelToday?.wordsAdded ?? 0,
    novelRemoved: novelToday?.wordsRemoved ?? 0,
    todayWords,
    todayAdded: today?.wordsAdded ?? 0,
    todayRemoved: today?.wordsRemoved ?? 0,
    streak: todayWords > 0 ? todayStreak : carried,
    streakIfWriteToday: todayWords > 0 ? todayStreak : streakFor(1, yesterday),
    dailyGoal,
    goalMet: todayWords >= dailyGoal,
  };
}

export async function getWritingSummary(
  userId: string,
  novelId: string | null = null,
  db: Db = prisma,
): Promise<WritingSummary> {
  const { settings, today, yesterday, novelToday } = await loadDays(db, userId, novelId);
  return summarize(today, yesterday, settings.dailyGoal, novelToday);
}

/** One day of the streak's week-dots row. */
export interface WeekDay {
  /** "YYYY-MM-DD". */
  day: string;
  isToday: boolean;
  /** Later this week — nothing to show yet, not the same as a day with no words. */
  isFuture: boolean;
  wordsWritten: number;
  goalMet: boolean;
}

/**
 * The current calendar week, Monday first, across every novel — the same scope as the streak
 * itself. Days after today are marked `isFuture` rather than simply "0 words", so the row
 * reads as a week in progress instead of a week half-failed.
 */
export async function getCurrentWeekDays(userId: string, db: Db = prisma): Promise<WeekDay[]> {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const keys = days.map(dayKey);
  const todayKey = dayKey(now);

  const rows = await db.writingSession.findMany({
    where: { userId, day: { in: keys } },
    select: { day: true, wordsWritten: true, goalMet: true },
  });
  const byDay = new Map(rows.map((row) => [row.day, row]));

  return keys.map((key, index) => {
    const row = byDay.get(key);
    return {
      day: key,
      isToday: key === todayKey,
      isFuture: days[index] > now && key !== todayKey,
      wordsWritten: row?.wordsWritten ?? 0,
      goalMet: row?.goalMet ?? false,
    };
  });
}

/**
 * Applies one save's contribution to today's figures and recomputes the streak. Writes two
 * rows: the novel's day and the writer's day. They are kept separately rather than one being
 * derived from the other, because the writer's day has to survive a novel being deleted.
 */
export async function recordWriting(
  db: Db,
  change: WritingDelta,
  novelId: string,
  userId: string,
): Promise<WritingSummary> {
  if (change.delta === 0 && change.added === 0 && change.removed === 0) {
    return getWritingSummary(userId, novelId, db);
  }

  const { now, settings, today, yesterday, novelToday } = await loadDays(db, userId, novelId);
  const day = dayKey(now);

  const row: SessionRow = {
    wordsWritten: Math.max(0, (today?.wordsWritten ?? 0) + change.delta),
    wordsAdded: (today?.wordsAdded ?? 0) + change.added,
    wordsRemoved: (today?.wordsRemoved ?? 0) + change.removed,
    streakCount: 0,
  };
  row.streakCount = streakFor(row.wordsWritten, yesterday);
  const goalMet = row.wordsWritten >= settings.dailyGoal;

  const novelRow: NovelDayRow = {
    wordsWritten: Math.max(0, (novelToday?.wordsWritten ?? 0) + change.delta),
    wordsAdded: (novelToday?.wordsAdded ?? 0) + change.added,
    wordsRemoved: (novelToday?.wordsRemoved ?? 0) + change.removed,
  };

  await db.writingSession.upsert({
    where: { userId_day: { userId, day } },
    update: { ...row, goalMet },
    create: { userId, day, ...row, goalMet },
  });
  await db.novelDay.upsert({
    where: { novelId_day: { novelId, day } },
    update: novelRow,
    create: { novelId, day, ...novelRow },
  });

  return summarize(row, yesterday, settings.dailyGoal, novelRow);
}
