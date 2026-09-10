"use server";

import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeChapter } from "@/lib/auth/guard";
import { syncMentions } from "@/lib/data/mentions";
import { pruneSnapshots, type SnapshotCard } from "@/lib/data/snapshots";
import { prisma } from "@/lib/db";
import { docToPlainText, parseDoc } from "@/lib/editor/word-count";

const idSchema = z.string().min(1);

/** The first stretch of prose, so a version can be recognised without opening it. */
function preview(content: string): string {
  const doc = parseDoc(content);
  if (!doc) return "Unreadable text — kept exactly as it was.";
  const text = docToPlainText(doc).replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text || "Empty.";
}

export async function listSnapshots(
  chapterId: string,
): Promise<ActionResult<{ snapshots: SnapshotCard[]; limit: number | null }>> {
  const parsed = idSchema.safeParse(chapterId);
  if (!parsed.success) return fail("That chapter id is not valid.");

  const auth = await authorizeChapter(parsed.data);
  if (!auth.ok) return auth;

  const rows = await prisma.chapterSnapshot.findMany({
    where: { chapterId: parsed.data },
    orderBy: { createdAt: "desc" },
    select: { id: true, wordCount: true, reason: true, createdAt: true, content: true },
  });

  return {
    ok: true,
    // The dialog's subtitle reads "12 of 20 kept", so it needs the ceiling as well as the rows.
    limit: auth.capabilities.snapshotsPerChapter,
    snapshots: rows.map((row) => ({
      id: row.id,
      wordCount: row.wordCount,
      reason: row.reason,
      createdAt: row.createdAt,
      preview: preview(row.content),
    })),
  };
}

const restoreSchema = z.object({ chapterId: idSchema, snapshotId: idSchema });

export interface RestoreResult {
  content: string;
  wordCount: number;
}

/**
 * Puts an earlier version back.
 *
 * The current text is snapshotted first, unconditionally — restoring is itself a large change,
 * and a restore you cannot undo would be a worse trap than the one this feature exists to
 * prevent. The content is returned rather than only written, so the open editor can adopt it
 * without a reload racing the next autosave.
 */
export async function restoreSnapshot(input: z.input<typeof restoreSchema>): Promise<ActionResult<RestoreResult>> {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return fail("That restore request was not valid.");
  const { chapterId, snapshotId } = parsed.data;

  const auth = await authorizeChapter(chapterId);
  if (!auth.ok) return auth;

  try {
    return await prisma.$transaction(async (tx) => {
      const snapshot = await tx.chapterSnapshot.findUnique({
        where: { id: snapshotId },
        select: { chapterId: true, content: true, wordCount: true },
      });
      if (!snapshot || snapshot.chapterId !== chapterId) return fail("That version is no longer available.");

      const current = await tx.chapter.findUnique({
        where: { id: chapterId },
        select: { content: true, wordCount: true },
      });
      if (!current) return fail("That chapter no longer exists.");

      if (current.content) {
        await tx.chapterSnapshot.create({
          data: {
            chapterId,
            content: current.content,
            wordCount: current.wordCount,
            reason: "before-restore",
          },
        });
        // This copy is kept whatever the rules say, so the limit has to be enforced here too.
        await pruneSnapshots(tx, chapterId, auth.capabilities.snapshotsPerChapter);
      }

      await tx.chapter.update({
        where: { id: chapterId },
        data: { content: snapshot.content, wordCount: snapshot.wordCount },
      });
      // The restored text carries its own @mentions; the index has to follow it.
      await syncMentions(tx, chapterId, parseDoc(snapshot.content));

      return { ok: true as const, content: snapshot.content, wordCount: snapshot.wordCount };
    });
  } catch (error) {
    console.error("restoreSnapshot failed", error);
    return fail("Restoring failed on the server. Nothing was changed.");
  }
}
