"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorize } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

/**
 * The writing targets: the daily goal, and the sweet-spot band.
 *
 * These live on `AuthorSettings` rather than in localStorage because they are facts about the
 * *writer*, not about the screen they happen to be sitting at — the same split the appearance
 * store documents from the other side. A writer's goal should follow them to another machine;
 * their page brightness should not.
 *
 * Until now there was no way to change either from inside the app; both were whatever the row
 * was created with. The account page is where they belong, next to the pen name.
 */

const targetsSchema = z
  .object({
    dailyGoal: z.number().int().min(0, "A goal cannot be negative.").max(50_000, "That goal is not a day's work."),
    sweetSpotMin: z.number().int().min(0).max(50_000),
    sweetSpotMax: z.number().int().min(0).max(50_000),
  })
  .refine((value) => value.sweetSpotMin < value.sweetSpotMax, {
    message: "The sweet spot has to start below where it ends.",
    path: ["sweetSpotMax"],
  });

export async function updateWritingTargets(input: z.input<typeof targetsSchema>): Promise<ActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const parsed = targetsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Those targets could not be read.");

  await prisma.authorSettings.upsert({
    where: { userId: auth.user.id },
    update: parsed.data,
    create: { userId: auth.user.id, ...parsed.data },
  });

  // The goal and the band are painted by the Progress panel and the manuscript footer, both of
  // which are server-rendered in a different route slot from this form.
  revalidatePath("/", "layout");
  return { ok: true };
}
