import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { mentionsInDoc } from "@/lib/editor/mentions";
import type { DocNode } from "@/lib/editor/word-count";

/**
 * The `ChapterCodex` mention index, rewritten to match a document.
 *
 * Lives here rather than beside the save action because *any* write that replaces a
 * chapter's content has to keep the index honest, not only an ordinary save. Restoring a
 * snapshot is the other one: it swaps in text written at a different time, with different
 * @mentions in it, and leaving the index alone left the Codex's "where it appears" counting
 * mentions that were no longer in the chapter until the writer happened to type again.
 */
export async function syncMentions(
  tx: Prisma.TransactionClient,
  chapterId: string,
  doc: DocNode | null,
): Promise<void> {
  const counts = doc ? mentionsInDoc(doc) : new Map<string, number>();
  const ids = [...counts.keys()];
  // Entries deleted from the codex may still be tagged in text; never index those.
  const existing = ids.length
    ? await tx.codexEntry.findMany({ where: { id: { in: ids } }, select: { id: true } })
    : [];
  const keep = existing.map((entry) => entry.id);

  await tx.chapterCodex.deleteMany({ where: { chapterId, codexEntryId: { notIn: keep } } });
  for (const codexEntryId of keep) {
    const mentionCount = counts.get(codexEntryId) ?? 1;
    await tx.chapterCodex.upsert({
      where: { chapterId_codexEntryId: { chapterId, codexEntryId } },
      update: { mentionCount },
      create: { chapterId, codexEntryId, mentionCount },
    });
  }
}
