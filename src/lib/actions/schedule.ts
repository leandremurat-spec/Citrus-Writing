"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeChapter, authorizeNovel, requireCapability } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getCadence } from "@/lib/data/schedule";
import { nextSlots, weekdaysNeeded } from "@/lib/schedule/cadence";

function revalidateWorkspace() {
  revalidatePath("/", "layout");
}

const idSchema = z.string().min(1);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 09:00.");

const updateCadenceSchema = z
  .object({
    novelId: idSchema,
    frequency: z.enum(["FORTNIGHTLY", "WEEKLY", "TWICE_WEEKLY", "THRICE_WEEKLY", "DAILY", "TWICE_DAILY"]),
    // Deduplicated before the counts below are checked: `[3, 3]` would otherwise satisfy
    // "twice weekly needs two days" and then collapse to one on the way into the database,
    // turning a twice-weekly cadence into a weekly one without saying so.
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    time: timeSchema,
    timeSecond: timeSchema,
    targetWeeks: z.number().int().min(1).max(12),
  })
  // One rule instead of a pair per frequency: `weekdaysNeeded` already knows how many days
  // each cadence asks for, and the daily ones ask for none.
  .superRefine((value, ctx) => {
    const needed = weekdaysNeeded(value.frequency);
    if (value.weekdays.length === needed) return;
    ctx.addIssue({
      code: "custom",
      path: ["weekdays"],
      message: needed === 1 ? "Pick one day." : `That cadence needs ${needed} days.`,
    });
  })
  .refine((value) => value.frequency !== "TWICE_DAILY" || value.time !== value.timeSecond, {
    message: "The two releases need different times.",
    path: ["timeSecond"],
  });

/** Changing the cadence resets its Fortnightly anchor to now, so the on/off week pattern
    always restarts cleanly from the change rather than drifting against some old date. */
export async function updateCadence(input: z.input<typeof updateCadenceSchema>): Promise<ActionResult> {
  const parsed = updateCadenceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That schedule could not be understood.");
  const { novelId, frequency, weekdays, time, timeSecond, targetWeeks } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;
  const denied = requireCapability(auth, "buffer", "The release schedule");
  if (denied) return denied;

  try {
    await prisma.novel.update({
      where: { id: novelId },
      data: {
        cadenceFrequency: frequency,
        cadenceWeekdays: weekdays.join(","),
        cadenceTime: time,
        cadenceTimeSecond: timeSecond,
        cadenceTargetWeeks: targetWeeks,
        cadenceAnchor: new Date(),
      },
    });
  } catch {
    return fail("That novel no longer exists.");
  }
  revalidateWorkspace();
  return { ok: true };
}

const scheduleSchema = z.object({ chapterId: idSchema, date: z.coerce.date() });

/** A chapter can only be queued once it is Edited — a draft going onto the calendar is the
    shape of accident this exists to prevent. */
export async function scheduleChapter(input: z.input<typeof scheduleSchema>): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail("That date could not be understood.");

  const auth = await authorizeChapter(parsed.data.chapterId);
  if (!auth.ok) return auth;
  const denied = requireCapability(auth, "buffer", "Scheduling a chapter");
  if (denied) return denied;

  const chapter = await prisma.chapter.findUnique({ where: { id: parsed.data.chapterId }, select: { status: true } });
  if (!chapter) return fail("That chapter no longer exists.");
  if (chapter.status === "DRAFT") return fail("A chapter can only be queued once it is Edited.");

  await prisma.chapter.update({
    where: { id: parsed.data.chapterId },
    // The slot’s own moment, not its midnight: a twice-daily cadence distinguishes its two
    // releases by time, and flattening here would collapse them onto each other.
    data: { scheduledFor: parsed.data.date },
  });
  revalidateWorkspace();
  return { ok: true };
}

const unscheduleSchema = z.object({ chapterId: idSchema });

export async function unscheduleChapter(input: z.input<typeof unscheduleSchema>): Promise<ActionResult> {
  const parsed = unscheduleSchema.safeParse(input);
  if (!parsed.success) return fail("That chapter could not be found.");

  const auth = await authorizeChapter(parsed.data.chapterId);
  if (!auth.ok) return auth;
  // Deliberately *not* gated on the buffer capability. Clearing a date is how a writer who
  // has dropped to Drawer tidies up a schedule they can no longer edit; refusing it would
  // trap the plan's own leftovers on the board.

  try {
    await prisma.chapter.update({ where: { id: parsed.data.chapterId }, data: { scheduledFor: null } });
  } catch {
    // Every other action in this file returns its failure; letting Prisma's "record not
    // found" escape here would surface as a framework error instead of a toast.
    return fail("That chapter no longer exists.");
  }
  revalidateWorkspace();
  return { ok: true };
}

const queueNextSchema = z.object({ novelId: idSchema, chapterId: idSchema });

/** The Bench's one-click "Queue": the earliest future slot that nothing else already fills. */
export async function queueNextOpenSlot(input: z.input<typeof queueNextSchema>): Promise<ActionResult> {
  const parsed = queueNextSchema.safeParse(input);
  if (!parsed.success) return fail("That chapter could not be found.");
  const { novelId, chapterId } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;
  const denied = requireCapability(auth, "buffer", "Queueing a chapter");
  if (denied) return denied;

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { status: true, novelId: true } });
  if (!chapter || chapter.novelId !== novelId) return fail("That chapter no longer exists.");
  if (chapter.status === "DRAFT") return fail("A chapter can only be queued once it is Edited.");

  const cadence = await getCadence(novelId);
  const candidates = nextSlots(cadence, new Date(), 26);
  const taken = await prisma.chapter.findMany({
    where: { novelId, scheduledFor: { in: candidates } },
    select: { scheduledFor: true },
  });
  const takenMoments = new Set(taken.map((row) => row.scheduledFor!.getTime()));
  const open = candidates.find((date) => !takenMoments.has(date.getTime()));
  if (!open) return fail("The next few weeks are already full — open the calendar and pick a date further out.");

  await prisma.chapter.update({ where: { id: chapterId }, data: { scheduledFor: open } });
  revalidateWorkspace();
  return { ok: true };
}
