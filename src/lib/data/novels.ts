import "server-only";

import type { BinderNode, ChapterStatus } from "@/lib/binder/tree";
import { flattenTree } from "@/lib/binder/tree";
import { parseSheetFields } from "@/lib/codex/sheet-fields";
import type { ChapterMention, CodexEntryCard } from "@/lib/codex/types";
import { prisma } from "@/lib/db";

/*
 * Every read in this file is scoped to one writer, and takes their id as a *required*
 * parameter rather than reaching for the session itself.
 *
 * That is the whole safety argument: a required parameter turns "I forgot to scope this
 * query" from a silent cross-account data leak into a compile error at the call site. The
 * alternative — each function calling getCurrentUser() on its own — reads more tidily and
 * fails invisibly the first time someone adds a function and forgets, which is exactly the
 * bug that must never happen here.
 */

// ---------- novels ----------

export interface NovelSummary {
  id: string;
  title: string;
  chapterCount: number;
}

export async function listNovels(userId: string): Promise<NovelSummary[]> {
  const novels = await prisma.novel.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, _count: { select: { chapters: true } } },
  });
  return novels.map((novel) => ({ id: novel.id, title: novel.title, chapterCount: novel._count.chapters }));
}

/** One card in the Library's "Your serials" grid. */
export interface NovelCard {
  id: string;
  title: string;
  description: string | null;
  chapterCount: number;
  arcCount: number;
  wordCount: number;
  lastWrittenAt: Date | null;
  /** Every chapter's status, in run order — the grid card's own small, decorative run-dots. */
  runStatuses: ChapterStatus[];
}

export async function listNovelCards(userId: string): Promise<NovelCard[]> {
  const novels = await prisma.novel.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, description: true },
  });

  // One novel's tree at a time rather than a single cross-novel query, so this reuses the
  // exact same ordering `getBinderNodes`/`flattenTree` already give the Binder and the Run
  // band — a home-page summary that disagreed with those would be worse than a slower query.
  return Promise.all(
    novels.map(async (novel) => {
      const [nodes, latest] = await Promise.all([
        getBinderNodes(novel.id),
        prisma.chapter.findFirst({
          where: { novelId: novel.id },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
      const chapters = flattenTree(nodes).filter((node) => node.type === "chapter");
      return {
        id: novel.id,
        title: novel.title,
        description: novel.description,
        chapterCount: chapters.length,
        arcCount: nodes.filter((node) => node.type === "arc").length,
        wordCount: chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0),
        lastWrittenAt: latest?.updatedAt ?? null,
        runStatuses: chapters.map((chapter) => chapter.status ?? "DRAFT"),
      };
    }),
  );
}

/** The "Where you left off" card: the single most recently touched chapter, across every novel. */
export interface ContinueWriting {
  novelId: string;
  novelTitle: string;
  chapterId: string;
  chapterTitle: string;
  wordCount: number;
  sweetSpotMin: number;
  sweetSpotMax: number;
  updatedAt: Date;
  chapterCount: number;
  runStatuses: ChapterStatus[];
}

export async function getContinueWriting(userId: string): Promise<ContinueWriting | null> {
  const chapter = await prisma.chapter.findFirst({
    where: { novel: { userId } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      wordCount: true,
      novelId: true,
      updatedAt: true,
      novel: { select: { title: true } },
    },
  });
  if (!chapter) return null;

  const [settings, nodes] = await Promise.all([getSettings(userId), getBinderNodes(chapter.novelId)]);
  const chapters = flattenTree(nodes).filter((node) => node.type === "chapter");

  return {
    novelId: chapter.novelId,
    novelTitle: chapter.novel.title,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    wordCount: chapter.wordCount,
    sweetSpotMin: settings.sweetSpotMin,
    sweetSpotMax: settings.sweetSpotMax,
    updatedAt: chapter.updatedAt,
    chapterCount: chapters.length,
    runStatuses: chapters.map((c) => c.status ?? "DRAFT"),
  };
}

/** Null when the novel does not exist *or* is not this writer's — the caller notFound()s either
    way, and telling the two apart would confirm that someone else's id is real. */
export async function getNovel(novelId: string, userId: string) {
  return prisma.novel.findFirst({
    where: { id: novelId, userId },
    select: { id: true, title: true, description: true, createdAt: true, updatedAt: true },
  });
}

// ---------- binder tree ----------

interface VolumeRow {
  id: string;
  title: string;
  order: number;
}
interface ArcRow extends VolumeRow {
  volumeId: string | null;
}
interface ChapterRow extends VolumeRow {
  volumeId: string | null;
  arcId: string | null;
  status: ChapterStatus;
  wordCount: number;
}

/** Maps database rows onto the shared binder node shape (see `src/lib/binder/tree.ts`). */
export function toBinderNodes(volumes: VolumeRow[], arcs: ArcRow[], chapters: ChapterRow[]): BinderNode[] {
  return [
    ...volumes.map(
      (volume): BinderNode => ({
        type: "volume",
        id: volume.id,
        title: volume.title,
        order: volume.order,
        parent: { kind: "root" },
      }),
    ),
    ...arcs.map(
      (arc): BinderNode => ({
        type: "arc",
        id: arc.id,
        title: arc.title,
        order: arc.order,
        parent: arc.volumeId ? { kind: "volume", id: arc.volumeId } : { kind: "root" },
      }),
    ),
    ...chapters.map(
      (chapter): BinderNode => ({
        type: "chapter",
        id: chapter.id,
        title: chapter.title,
        order: chapter.order,
        status: chapter.status,
        wordCount: chapter.wordCount,
        parent: chapter.arcId
          ? { kind: "arc", id: chapter.arcId }
          : chapter.volumeId
            ? { kind: "volume", id: chapter.volumeId }
            : { kind: "root" },
      }),
    ),
  ];
}

export async function getBinderNodes(novelId: string): Promise<BinderNode[]> {
  const [volumes, arcs, chapters] = await Promise.all([
    prisma.volume.findMany({ where: { novelId }, select: { id: true, title: true, order: true } }),
    prisma.arc.findMany({ where: { novelId }, select: { id: true, title: true, order: true, volumeId: true } }),
    prisma.chapter.findMany({
      where: { novelId },
      select: { id: true, title: true, order: true, volumeId: true, arcId: true, status: true, wordCount: true },
    }),
  ]);
  return toBinderNodes(volumes, arcs, chapters);
}

// ---------- chapters ----------

export async function getChapter(chapterId: string, userId: string) {
  return prisma.chapter.findFirst({
    where: { id: chapterId, novel: { userId } },
    include: {
      arc: { select: { id: true, title: true, volume: { select: { id: true, title: true } } } },
      volume: { select: { id: true, title: true } },
    },
  });
}

/** Just enough of a chapter for the side panel and the tab title. */
export async function getChapterBrief(chapterId: string, userId: string) {
  return prisma.chapter.findFirst({
    where: { id: chapterId, novel: { userId } },
    select: { id: true, novelId: true, title: true, notes: true, wordCount: true },
  });
}

/** The chapter the author touched most recently, so the app reopens where they left off. */
export async function getLatestChapterId(novelId: string): Promise<string | null> {
  const chapter = await prisma.chapter.findFirst({
    where: { novelId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return chapter?.id ?? null;
}

// ---------- codex ----------

export async function getCodexEntries(novelId: string): Promise<CodexEntryCard[]> {
  const entries = await prisma.codexEntry.findMany({
    where: { novelId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      summary: true,
      description: true,
      avatarUrl: true,
      aliases: true,
      sheetFields: true,
      _count: { select: { chapters: true } },
      chapters: {
        orderBy: { mentionCount: "desc" },
        take: 12,
        select: { mentionCount: true, chapter: { select: { id: true, title: true } } },
      },
    },
  });
  return entries.map(({ _count, chapters, sheetFields, ...entry }) => ({
    ...entry,
    sheetFields: parseSheetFields(sheetFields),
    chapterCount: _count.chapters,
    mentionedIn: chapters.map((link) => ({
      chapterId: link.chapter.id,
      title: link.chapter.title,
      mentionCount: link.mentionCount,
    })),
  }));
}

export async function getChapterMentions(chapterId: string): Promise<ChapterMention[]> {
  return prisma.chapterCodex.findMany({
    where: { chapterId },
    select: { codexEntryId: true, mentionCount: true },
  });
}

// ---------- settings ----------

/** The writer's targets, created on demand — an account made before this row existed, or one
    whose settings were never written, should not 500 on the first page load. */
export async function getSettings(userId: string) {
  return prisma.authorSettings.upsert({ where: { userId }, update: {}, create: { userId } });
}

// Writing sessions and streaks live in `src/lib/data/writing.ts`.
