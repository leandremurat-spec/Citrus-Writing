"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeChapter, authorizeNovel } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

const idSchema = z.string().min(1);

const titleSchema = z.object({
  chapterId: idSchema,
  title: z.string().trim().min(1, "Give the chapter a title.").max(200, "Keep the title under 200 characters."),
});

export async function updateChapterTitle(input: z.input<typeof titleSchema>): Promise<ActionResult> {
  const parsed = titleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid title.");

  const auth = await authorizeChapter(parsed.data.chapterId);
  if (!auth.ok) return auth;

  try {
    await prisma.chapter.update({ where: { id: parsed.data.chapterId }, data: { title: parsed.data.title } });
  } catch {
    return fail("That chapter no longer exists.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const statusSchema = z.object({
  chapterId: idSchema,
  status: z.enum(["DRAFT", "EDITED", "QUEUED", "PUBLISHED"]),
});

export async function setChapterStatus(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail("That status is not recognised.");
  const { chapterId, status } = parsed.data;

  const auth = await authorizeChapter(chapterId);
  if (!auth.ok) return auth;

  const current = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { publishedAt: true } });
  if (!current) return fail("That chapter no longer exists.");

  await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      status,
      // First publish stamps the date; later status changes keep it as history.
      publishedAt: status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const notesSchema = z.object({
  chapterId: idSchema,
  notes: z.string().max(20_000, "Notes are limited to 20,000 characters."),
});

/** Saves chapter notes. No revalidation: only the panel that saved them shows them. */
export async function updateChapterNotes(input: z.input<typeof notesSchema>): Promise<ActionResult> {
  const parsed = notesSchema.safeParse(input);
  if (parsed.success) {
    const auth = await authorizeChapter(parsed.data.chapterId);
    if (!auth.ok) return auth;
  }
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid notes.");
  try {
    await prisma.chapter.update({
      where: { id: parsed.data.chapterId },
      data: { notes: parsed.data.notes.length > 0 ? parsed.data.notes : null },
    });
  } catch {
    return fail("That chapter no longer exists.");
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Bulk actions                                                       */
/*                                                                     */
/*  Selecting a run of chapters and acting on all of them is the       */
/*  difference between publishing a backlog and clicking forty menus.  */
/*  Both of these scope every write to one novel and take the ids as   */
/*  a set, so a stale id in the client's selection cannot reach into   */
/*  another book.                                                      */
/* ------------------------------------------------------------------ */

const bulkSchema = z.object({
  novelId: idSchema,
  chapterIds: z
    .array(idSchema)
    .min(1, "Nothing was selected.")
    .max(500, "That is more chapters than this can do at once.")
    .transform((ids) => [...new Set(ids)]),
});

const bulkStatusSchema = bulkSchema.extend({
  status: z.enum(["DRAFT", "EDITED", "QUEUED", "PUBLISHED"]),
});

export async function setChaptersStatus(
  input: z.input<typeof bulkStatusSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That change could not be understood.");
  const { novelId, chapterIds, status } = parsed.data;

  // The novel is the scope of the bulk update as well as the thing being authorized: every
  // `where` below carries novelId, so ids from another writer's serial simply match nothing.
  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const count = await prisma.$transaction(async (tx) => {
    const scope = { novelId, id: { in: chapterIds } };
    // `publishedAt` is stamped the first time a chapter goes out and never cleared afterwards,
    // so a chapter moved back to Draft and published again keeps the date readers first saw it.
    // That is one extra write rather than one clever one, and it only runs when publishing.
    if (status === "PUBLISHED") {
      await tx.chapter.updateMany({ where: { ...scope, publishedAt: null }, data: { publishedAt: new Date() } });
    }
    const result = await tx.chapter.updateMany({ where: scope, data: { status } });
    return result.count;
  });

  revalidatePath("/", "layout");
  return { ok: true, count };
}

/**
 * Deletes several chapters at once. Chapters are the one node type this app removes for good —
 * volumes and arcs release their children instead — so the caller is expected to have confirmed
 * first, the same as the single-chapter delete in `binder.ts`.
 */
export async function deleteChapters(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Nothing was selected.");
  const { novelId, chapterIds } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const result = await prisma.chapter.deleteMany({ where: { novelId, id: { in: chapterIds } } });
  revalidatePath("/", "layout");
  return { ok: true, count: result.count };
}
