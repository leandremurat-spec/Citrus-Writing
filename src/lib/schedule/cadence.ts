/**
 * Pure release-cadence math: no React, no database. Given a cadence, which calendar days are
 * release slots, going forward or back from any date. `Novel.cadence*` columns are the only
 * source of truth this reads from; server actions and data loaders both go through this.
 */
import { addDays, addMinutes, differenceInCalendarDays, startOfDay, startOfWeek } from "date-fns";

export type CadenceFrequency =
  | "FORTNIGHTLY"
  | "WEEKLY"
  | "TWICE_WEEKLY"
  | "THRICE_WEEKLY"
  | "DAILY"
  | "TWICE_DAILY";

export interface Cadence {
  frequency: CadenceFrequency;
  /** JS weekdays, 0 (Sun) – 6 (Sat). `weekdaysNeeded` says how many this frequency wants;
      the daily cadences release every day and ignore this entirely. */
  weekdays: number[];
  /** "HH:mm", local time. Display only — nothing here schedules a real-world action at it. */
  time: string;
  /** The second release of the day. Only TWICE_DAILY has one. */
  timeSecond: string;
  targetWeeks: number;
  /** Reference point for Fortnightly's on/off week pattern. Ignored otherwise. */
  anchor: Date;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function weekdayName(day: number): string {
  return WEEKDAY_NAMES[day] ?? "Saturday";
}

/** How many release slots make up one week, for converting "N slots deep" into "N weeks". */
export function slotsPerWeek(frequency: CadenceFrequency): number {
  switch (frequency) {
    case "FORTNIGHTLY": return 0.5;
    case "WEEKLY": return 1;
    case "TWICE_WEEKLY": return 2;
    case "THRICE_WEEKLY": return 3;
    case "DAILY": return 7;
    case "TWICE_DAILY": return 14;
  }
}

/** How many weekdays this frequency asks the writer to pick. Zero means it releases daily. */
export function weekdaysNeeded(frequency: CadenceFrequency): number {
  switch (frequency) {
    case "TWICE_WEEKLY": return 2;
    case "THRICE_WEEKLY": return 3;
    case "DAILY":
    case "TWICE_DAILY": return 0;
    default: return 1;
  }
}

/** How many releases land on one release day. Only the twice-daily cadence has two. */
export function slotsPerDay(frequency: CadenceFrequency): number {
  return frequency === "TWICE_DAILY" ? 2 : 1;
}

/**
 * The times of day a release day carries, as minutes past midnight.
 *
 * The first slot of every day is midnight rather than `cadence.time`, and that is deliberate
 * rather than sloppy: `scheduledFor` has always held `startOfDay`, so anchoring slot one
 * anywhere else would strand every chapter already on the calendar. The clock time is what the
 * board *displays*; it only becomes load-bearing for the second release of a day, which needs
 * something to tell it apart from the first.
 */
function slotOffsets(cadence: Cadence): number[] {
  if (cadence.frequency !== "TWICE_DAILY") return [0];
  const [hours, minutes] = cadence.timeSecond.split(":").map(Number);
  const offset = (Number.isFinite(hours) ? hours : 21) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  return [0, Math.max(1, offset)];
}

/** Whether a date is a release slot under this cadence. */
export function isSlotDay(cadence: Cadence, date: Date): boolean {
  // Daily cadences release every day, so the chosen weekdays are not consulted at all.
  if (weekdaysNeeded(cadence.frequency) === 0) return true;
  if (!cadence.weekdays.includes(date.getDay())) return false;
  if (cadence.frequency !== "FORTNIGHTLY") return true;
  const weeksSinceAnchor = Math.floor(
    differenceInCalendarDays(startOfWeek(date, { weekStartsOn: 1 }), startOfWeek(cadence.anchor, { weekStartsOn: 1 })) / 7,
  );
  // A negative remainder (dates before the anchor) still lands on 0 or 1 correctly in JS only
  // for positive divisors with `%`; guard by normalizing to a non-negative remainder.
  return ((weeksSinceAnchor % 2) + 2) % 2 === 0;
}

/** A day-by-day walk rather than closed-form arithmetic, so Weekly, Twice weekly, and
    Fortnightly all share one implementation instead of three. Serials run for years, not
    centuries, so the scan cap is generous without being unbounded. */
const MAX_SCAN_DAYS = 400;

/** Every release moment on one release day, ascending. One entry, or two under TWICE_DAILY. */
function slotsOn(cadence: Cadence, day: Date): Date[] {
  return slotOffsets(cadence).map((minutes) => addMinutes(day, minutes));
}

/** The next `count` release dates on or after `from`, ascending. */
export function nextSlots(cadence: Cadence, from: Date, count: number): Date[] {
  const slots: Date[] = [];
  let cursor = startOfDay(from);
  for (let i = 0; slots.length < count && i < MAX_SCAN_DAYS; i++) {
    if (isSlotDay(cadence, cursor)) {
      for (const slot of slotsOn(cadence, cursor)) {
        if (slots.length < count) slots.push(slot);
      }
    }
    cursor = addDays(cursor, 1);
  }
  return slots;
}

/** The `count` release dates strictly before `from`, ascending (oldest first). */
export function previousSlots(cadence: Cadence, from: Date, count: number): Date[] {
  const slots: Date[] = [];
  let cursor = addDays(startOfDay(from), -1);
  for (let i = 0; slots.length < count && i < MAX_SCAN_DAYS; i++) {
    if (isSlotDay(cadence, cursor)) slots.unshift(...slotsOn(cadence, cursor));
    cursor = addDays(cursor, -1);
  }
  return slots.slice(-count);
}

const FREQUENCY_PHRASE: Record<CadenceFrequency, string> = {
  FORTNIGHTLY: "One chapter every two weeks",
  WEEKLY: "One chapter a week",
  TWICE_WEEKLY: "Two chapters a week",
  THRICE_WEEKLY: "Three chapters a week",
  DAILY: "One chapter a day",
  TWICE_DAILY: "Two chapters a day",
};

export function describeCadence(cadence: Cadence): string {
  const phrase = FREQUENCY_PHRASE[cadence.frequency];
  if (cadence.frequency === "TWICE_DAILY") return `${phrase}, at ${cadence.time} and ${cadence.timeSecond}.`;
  if (cadence.frequency === "DAILY") return `${phrase}, at ${cadence.time}.`;
  const days = cadence.weekdays.map(weekdayName).join(", ").replace(/, ([^,]*)$/, " and $1");
  return `${phrase}, ${days} at ${cadence.time}.`;
}
