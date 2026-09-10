import "server-only";

import { flattenTree } from "@/lib/binder/tree";
import { parseSheetFields, type SheetField } from "@/lib/codex/sheet-fields";
import { findUnlinked, namePattern } from "@/lib/codex/unlinked";
import { splitAliases, type CodexCategory } from "@/lib/codex/types";
import { parseDoc } from "@/lib/editor/word-count";
import { prisma } from "@/lib/db";

import { getBinderNodes } from "./novels";

export interface CodexEntryDetail {
  id: string;
  novelId: string;
  name: string;
  category: CodexCategory;
  summary: string | null;
  description: string | null;
  avatarUrl: string | null;
  aliases: string | null;
  sheetFields: SheetField[];
}

export async function getCodexEntryDetail(id: string): Promise<CodexEntryDetail | null> {
  const entry = await prisma.codexEntry.findUnique({
    where: { id },
    select: {
      id: true,
      novelId: true,
      name: true,
      category: true,
      summary: true,
      description: true,
      avatarUrl: true,
      aliases: true,
      sheetFields: true,
    },
  });
  if (!entry) return null;
  return { ...entry, sheetFields: parseSheetFields(entry.sheetFields) };
}

export interface CodexTieRow {
  id: string;
  label: string;
  description: string;
  target: { id: string; name: string; category: CodexCategory; avatarUrl: string | null };
}

/** Ties authored from this entry's point of view. See the schema comment on CodexTie. */
export async function getCodexTies(entryId: string): Promise<CodexTieRow[]> {
  const rows = await prisma.codexTie.findMany({
    where: { fromEntryId: entryId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      label: true,
      description: true,
      toEntry: { select: { id: true, name: true, category: true, avatarUrl: true } },
    },
  });
  return rows.map((row) => ({ id: row.id, label: row.label, description: row.description, target: row.toEntry }));
}

/** Every other entry in the novel, for the "tie to" picker — a self-tie makes no sense. */
export async function getOtherCodexEntries(
  novelId: string,
  excludeId: string,
): Promise<{ id: string; name: string; category: CodexCategory }[]> {
  return prisma.codexEntry.findMany({
    where: { novelId, id: { not: excludeId } },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });
}

/** "Prologue"/"Interlude"/"Epilogue" chapters get their own short label; numbered ones get their run number. */
function shortChapterLabel(title: string, runNumber: number): string {
  const lower = title.toLowerCase();
  if (lower.startsWith("prologue")) return "Pro";
  if (lower.startsWith("interlude")) return "Int";
  if (lower.startsWith("epilogue")) return "Epi";
  return String(runNumber);
}

export interface MentionThreadChapter {
  chapterId: string;
  label: string;
  title: string;
  mentioned: boolean;
}

export interface MentionThread {
  chapters: MentionThreadChapter[];
  /** Sum of `ChapterCodex.mentionCount` across every chapter — occurrences, not chapter count. */
  totalMentions: number;
}

/** The entry's thread through the run: every chapter in the novel, and whether it appears there. */
export async function getMentionThread(novelId: string, entryId: string): Promise<MentionThread> {
  const [nodes, links] = await Promise.all([
    getBinderNodes(novelId),
    prisma.chapterCodex.findMany({ where: { codexEntryId: entryId }, select: { chapterId: true, mentionCount: true } }),
  ]);
  const mentioned = new Map(links.map((link) => [link.chapterId, link.mentionCount]));

  let runNumber = 0;
  const chapters = flattenTree(nodes)
    .filter((node) => node.type === "chapter")
    .map((chapter) => {
      runNumber += 1;
      return {
        chapterId: chapter.id,
        label: shortChapterLabel(chapter.title, runNumber),
        title: chapter.title,
        mentioned: mentioned.has(chapter.id),
      };
    });
  const totalMentions = links.reduce((sum, link) => sum + link.mentionCount, 0);
  return { chapters, totalMentions };
}

export interface UnlinkedSummaryChapter {
  chapterId: string;
  title: string;
  count: number;
}

/**
 * A read-only, whole-novel scan for the entry's name written as plain text — the saved-content
 * counterpart to `lib/codex/unlinked.ts`'s live per-chapter scan. Nothing here rewrites
 * anything; linking still happens by opening the chapter and using the same mechanism as
 * always (see `UnlinkedMentions`), which is the one place it is safe to do because a real
 * editor, and this app's snapshot safety net, are both present there.
 */
export async function getUnlinkedMentionSummary(
  novelId: string,
  entry: { id: string; name: string; aliases: string | null },
): Promise<UnlinkedSummaryChapter[]> {
  const pattern = namePattern([entry.name, ...splitAliases(entry.aliases)]);
  if (!pattern) return [];

  const chapters = await prisma.chapter.findMany({
    where: { novelId },
    select: { id: true, title: true, content: true },
  });

  const summary: UnlinkedSummaryChapter[] = [];
  for (const chapter of chapters) {
    const doc = parseDoc(chapter.content);
    const hits = findUnlinked(doc, pattern);
    if (hits.length > 0) summary.push({ chapterId: chapter.id, title: chapter.title, count: hits.length });
  }
  return summary;
}
