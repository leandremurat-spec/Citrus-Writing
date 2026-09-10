import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Chapter snapshots: the safety net this app did not have.
 *
 * There is no undo across sessions, and early in development an editor mounting over content
 * that would not parse came within one autosave of destroying a chapter. Every save now has
 * the chance to keep the *previous* text, so there is always something to go back to.
 *
 * **How many copies are kept is a plan capability, not a constant here.** Drawer keeps
 * twenty, Serial keeps every one — so the limit arrives as a parameter (`null` meaning
 * unlimited) rather than being read from a module-level number. `SNAPSHOT_LIMIT` survives as
 * the Drawer figure the pricing page quotes, and as the fallback for any caller that has no
 * plan to hand.
 *
 * It is on by default rather than opt-in. A version history you have to remember to switch on
 * is not a safety net; it is a setting that only helps the people who already thought about
 * the problem, which is never the person who needs it. The cost is bounded — a fixed number
 * of copies per chapter, in a local SQLite file.
 *
 * Two rules decide whether a save is worth keeping:
 *   · **periodic** — nothing kept for this chapter in the last quarter of an hour;
 *   · **large-cut** — the save removes a substantial share of the chapter, which is exactly
 *     the shape of the accident this exists for, and is kept regardless of the clock.
 */

type Db = Prisma.TransactionClient;

/** How long a chapter goes between routine snapshots. */
const PERIODIC_MS = 15 * 60 * 1000;
/** Copies kept per chapter on the free plan; older ones are pruned on write. */
export const SNAPSHOT_LIMIT = 20;
/** A cut this large is always worth keeping, whatever the clock says. */
const LARGE_CUT_RATIO = 0.25;
const LARGE_CUT_WORDS = 150;

export type SnapshotReason = "periodic" | "large-cut";

export interface SnapshotCard {
  id: string;
  wordCount: number;
  reason: string;
  createdAt: Date;
  /** First line or so of the stored text, for recognising the version at a glance. */
  preview: string;
}

function reasonFor(previousWords: number, nextWords: number, lastAt: Date | null, now: Date): SnapshotReason | null {
  const cut = previousWords - nextWords;
  if (cut >= LARGE_CUT_WORDS || (previousWords > 0 && cut / previousWords >= LARGE_CUT_RATIO)) return "large-cut";
  if (!lastAt || now.getTime() - lastAt.getTime() >= PERIODIC_MS) return "periodic";
  return null;
}

/**
 * Keeps a copy of the text as it was *before* this save, when the rules say to. Runs inside
 * the save transaction, so a snapshot and the write it protects against succeed or fail
 * together. Empty previous content is never worth keeping.
 */
export async function maybeSnapshot(
  db: Db,
  chapterId: string,
  previous: { content: string; wordCount: number },
  nextWordCount: number,
  limit: number | null = SNAPSHOT_LIMIT,
  now = new Date(),
): Promise<void> {
  if (!previous.content) return;

  const latest = await db.chapterSnapshot.findFirst({
    where: { chapterId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, content: true },
  });

  // Nothing changed since the last copy: keeping a duplicate would push a real version out.
  if (latest?.content === previous.content) return;

  const reason = reasonFor(previous.wordCount, nextWordCount, latest?.createdAt ?? null, now);
  if (!reason) return;

  await db.chapterSnapshot.create({
    data: { chapterId, content: previous.content, wordCount: previous.wordCount, reason },
  });
  await pruneSnapshots(db, chapterId, limit);
}

/**
 * Trims a chapter back to the copies it is allowed to keep.
 *
 * Prunes by id rather than by date: two snapshots can share a timestamp to the millisecond.
 * Split out of `maybeSnapshot` because a restore also writes a copy — unconditionally, since
 * an unrepeatable restore would be a worse trap than the one this feature exists for — and so
 * a chapter restored twenty-one times used to sit above the limit indefinitely.
 */
export async function pruneSnapshots(db: Db, chapterId: string, limit: number | null = SNAPSHOT_LIMIT): Promise<void> {
  // Unlimited: nothing to prune, and no query worth running to find that out.
  if (limit === null) return;

  const keep = await db.chapterSnapshot.findMany({
    where: { chapterId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    take: limit,
  });
  await db.chapterSnapshot.deleteMany({
    where: { chapterId, id: { notIn: keep.map((row) => row.id) } },
  });
}
