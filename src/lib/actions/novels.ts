"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorize, authorizeNovel } from "@/lib/auth/guard";
import { canCreateNovel, PLANS, type PlanId } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  title: z.string().trim().min(1, "Give your novel a title.").max(200, "Keep the title under 200 characters."),
});

/**
 * Creates a novel with a starter "Arc 1" and "Chapter 1" so writing can begin immediately.
 *
 * This is where the Drawer plan's one-serial limit is actually enforced. Note what it does
 * *not* do: a writer who dropped from Serial to Drawer holding three serials keeps all three
 * — the pricing FAQ promises nothing is deleted or locked — they simply cannot make a fourth.
 * That is why the check is "may I add one more", counting what exists, rather than "am I over
 * the limit".
 */
export async function createNovel(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; chapterId: string }>> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid title.");

  const existing = await prisma.novel.count({ where: { userId: auth.user.id } });
  if (!canCreateNovel(auth.user.plan as PlanId, existing)) {
    const max = auth.capabilities.maxNovels ?? 0;
    return fail(
      PLANS[auth.user.plan as PlanId].name +
        " keeps " +
        (max === 1 ? "one serial" : max + " serials") +
        ". Serial makes it unlimited.",
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const novel = await tx.novel.create({
      data: { title: parsed.data.title, userId: auth.user.id },
      select: { id: true },
    });
    const arc = await tx.arc.create({
      data: { novelId: novel.id, title: "Arc 1", order: 0 },
      select: { id: true },
    });
    const chapter = await tx.chapter.create({
      data: { novelId: novel.id, arcId: arc.id, title: "Chapter 1", order: 0 },
      select: { id: true },
    });
    return { id: novel.id, chapterId: chapter.id };
  });

  revalidatePath("/", "layout");
  return { ok: true, ...created };
}

const deleteSchema = z.object({
  novelId: z.string().min(1),
  /** The novel's own title, typed by the writer. See below for why. */
  confirmTitle: z.string(),
});

/**
 * Deletes a novel and everything in it.
 *
 * `Novel` cascades to volumes, arcs, chapters, codex entries, ties and days, so this is the
 * single most destructive action in the app — and unlike a chapter, there is no snapshot table
 * standing behind it. That is why it asks the writer to type the title rather than click
 * "Are you sure": the check is not ceremony, it is the only thing between a mis-click and a
 * novel that cannot be recovered.
 *
 * The comparison is trimmed and case-insensitive. Matching exactly would fail on a trailing
 * space nobody can see, and this is a confirmation, not a password.
 */
export async function deleteNovel(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return fail("That request could not be understood.");
  const { novelId, confirmTitle } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const novel = await prisma.novel.findUnique({ where: { id: novelId }, select: { title: true } });
  if (!novel) return fail("That novel no longer exists.");

  const same = (value: string) => value.trim().toLocaleLowerCase();
  if (same(confirmTitle) !== same(novel.title)) {
    return fail("The title did not match, so nothing was deleted.");
  }

  try {
    await prisma.novel.delete({ where: { id: novelId } });
  } catch {
    return fail("That novel could not be deleted.");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
