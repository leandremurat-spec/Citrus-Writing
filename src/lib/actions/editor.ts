"use server";

import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeChapter } from "@/lib/auth/guard";
import { syncMentions } from "@/lib/data/mentions";
import { maybeSnapshot } from "@/lib/data/snapshots";
import { recordWriting, type WritingSummary } from "@/lib/data/writing";
import { prisma } from "@/lib/db";
import { countWordsInDoc, docToPlainText, parseDoc } from "@/lib/editor/word-count";
import { diffWords } from "@/lib/editor/word-diff";

const saveSchema = z.object({
  chapterId: z.string().min(1),
  /** Serialized TipTap JSON. Empty string means an empty chapter. */
  content: z.string().max(4_000_000, "This chapter is too large to save."),
});

export interface SaveChapterResult {
  wordCount: number;
  /** Words this save added and removed compared with the previously stored version. */
  added: number;
  removed: number;
  session: WritingSummary;
}

/**
 * Persists chapter content. The word count and the added/removed diff are computed on the
 * server (never trusted from the client) and feed today's writing session.
 * No revalidation: the editor owns the freshest copy and the binder gets live counts.
 */
export async function saveChapterContent(input: z.input<typeof saveSchema>): Promise<ActionResult<SaveChapterResult>> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid chapter content.");
  const { chapterId, content } = parsed.data;

  // Authorization before any work: this is the app's highest-traffic write, and the one that
  // would be worst to get wrong.
  const auth = await authorizeChapter(chapterId);
  if (!auth.ok) return auth;

  const doc = parseDoc(content);
  if (content !== "" && !doc) return fail("The chapter content could not be read, so it was not saved.");
  const wordCount = doc ? countWordsInDoc(doc) : 0;

  const current = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { wordCount: true, content: true, novelId: true },
  });
  if (!current) return fail("That chapter no longer exists.");

  const previousDoc = parseDoc(current.content);
  const { added, removed } = diffWords(previousDoc ? docToPlainText(previousDoc) : "", doc ? docToPlainText(doc) : "");

  try {
    const session = await prisma.$transaction(async (tx) => {
      // Before the write, not after: the copy has to be of the text this save replaces.
      await maybeSnapshot(
        tx,
        chapterId,
        { content: current.content, wordCount: current.wordCount },
        wordCount,
        auth.capabilities.snapshotsPerChapter,
      );
      await tx.chapter.update({ where: { id: chapterId }, data: { content, wordCount } });
      await syncMentions(tx, chapterId, doc);
      return recordWriting(
        tx,
        { delta: wordCount - current.wordCount, added, removed },
        current.novelId,
        auth.user.id,
      );
    });
    return { ok: true, wordCount, added, removed, session };
  } catch (error) {
    console.error("saveChapterContent failed", error);
    return fail("Saving failed on the server. Your words are still in the editor; it will retry.");
  }
}
