"use server";

import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeChapter, authorizeNovel } from "@/lib/auth/guard";
import { planAllowsScope, type PlanId } from "@/lib/billing/plans";
import { ROOT, descendantChapters, type ChapterStatus, type ContainerRef } from "@/lib/binder/tree";
import { getBinderNodes } from "@/lib/data/novels";
import { prisma } from "@/lib/db";

const schema = z.object({ chapterId: z.string().min(1) });

/**
 * The saved copy of a chapter, for exporting a chapter that is not the one open in the
 * editor. When the chapter *is* open, the dialog prefers the live document so unsaved edits
 * are included.
 */
export async function getChapterForExport(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ title: string; content: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("That chapter could not be found.");

  const auth = await authorizeChapter(parsed.data.chapterId);
  if (!auth.ok) return auth;

  const chapter = await prisma.chapter.findUnique({
    where: { id: parsed.data.chapterId },
    select: { title: true, content: true },
  });
  if (!chapter) return fail("That chapter no longer exists.");
  return { ok: true, title: chapter.title, content: chapter.content };
}

const scopeSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("arc"), novelId: z.string().min(1), arcId: z.string().min(1) }),
  z.object({ scope: z.literal("volume"), novelId: z.string().min(1), volumeId: z.string().min(1) }),
  z.object({ scope: z.literal("novel"), novelId: z.string().min(1) }),
]);

export interface ExportChapterRow {
  id: string;
  title: string;
  content: string;
  status: ChapterStatus;
  wordCount: number;
}

/**
 * Every chapter under an arc, a volume, or the whole novel, in run order — the same order the
 * Binder and the Run band already agree on (`descendantChapters`), so a multi-chapter export
 * reads the same order a reader would meet it in.
 */
export async function getChaptersForExport(
  input: z.input<typeof scopeSchema>,
): Promise<ActionResult<{ chapters: ExportChapterRow[] }>> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return fail("That scope could not be understood.");

  const auth = await authorizeNovel(parsed.data.novelId);
  if (!auth.ok) return auth;

  // Multi-chapter scope is a Serial feature, and this is where that is decided. The dialog
  // only offers the scopes the plan allows, but the dialog is a courtesy — an export scope
  // arriving from anywhere else is refused here.
  if (!planAllowsScope(auth.user.plan as PlanId, parsed.data.scope)) {
    return fail("Exporting more than one chapter at a time is part of the Serial plan.");
  }

  const nodes = await getBinderNodes(parsed.data.novelId);
  const container: ContainerRef =
    parsed.data.scope === "arc"
      ? { kind: "arc", id: parsed.data.arcId }
      : parsed.data.scope === "volume"
        ? { kind: "volume", id: parsed.data.volumeId }
        : ROOT;
  const ordered = descendantChapters(nodes, container);
  if (ordered.length === 0) return fail("There is nothing to export there yet.");

  const rows = await prisma.chapter.findMany({
    where: { id: { in: ordered.map((chapter) => chapter.id) } },
    select: { id: true, title: true, content: true, status: true, wordCount: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const chapters = ordered
    .map((chapter) => byId.get(chapter.id))
    .filter((row): row is ExportChapterRow => Boolean(row));

  return { ok: true, chapters };
}
