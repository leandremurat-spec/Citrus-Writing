"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeCodexTie, authorizeNovel, requireCapability } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

const idSchema = z.string().min(1);

const createSchema = z.object({
  novelId: idSchema,
  fromEntryId: idSchema,
  toEntryId: idSchema,
  label: z.string().trim().min(1, "Give the tie a short label.").max(40, "Keep the label under 40 characters."),
  description: z
    .string()
    .trim()
    .min(1, "Say what the tie is, in a sentence.")
    .max(300, "Keep it to a sentence or two."),
});

const deleteSchema = z.object({ id: idSchema });

function revalidateWorkspace() {
  revalidatePath("/", "layout");
}

/** A relationship from one codex entry to another, authored as a sentence, not a diagram. */
export async function createCodexTie(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid tie.");
  const { novelId, fromEntryId, toEntryId, label, description } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;
  const denied = requireCapability(auth, "codexTies", "Ties between codex entries");
  if (denied) return denied;

  if (fromEntryId === toEntryId) return fail("An entry cannot be tied to itself.");

  const [fromEntry, toEntry, order] = await Promise.all([
    prisma.codexEntry.findUnique({ where: { id: fromEntryId }, select: { novelId: true } }),
    prisma.codexEntry.findUnique({ where: { id: toEntryId }, select: { novelId: true } }),
    prisma.codexTie.count({ where: { fromEntryId } }),
  ]);
  if (!fromEntry || fromEntry.novelId !== novelId || !toEntry || toEntry.novelId !== novelId) {
    return fail("One of those entries no longer exists.");
  }

  const tie = await prisma.codexTie.create({
    data: { novelId, fromEntryId, toEntryId, label, description, order },
    select: { id: true },
  });
  revalidateWorkspace();
  return { ok: true, id: tie.id };
}

export async function deleteCodexTie(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (parsed.success) {
    // Not gated on the capability: a Drawer writer must be able to clear ties left behind by
    // a Serial subscription, for the same reason unscheduling stays open.
    const auth = await authorizeCodexTie(parsed.data.id);
    if (!auth.ok) return auth;
  }
  if (!parsed.success) return fail("That delete could not be understood.");
  try {
    await prisma.codexTie.delete({ where: { id: parsed.data.id } });
  } catch {
    return fail("That tie no longer exists.");
  }
  revalidateWorkspace();
  return { ok: true };
}
