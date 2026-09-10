"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions/result";
import { authorizeCodexEntry, authorizeNovel } from "@/lib/auth/guard";
import { parseSheetFields } from "@/lib/codex/sheet-fields";
import type { CodexEntryCard } from "@/lib/codex/types";
import { prisma } from "@/lib/db";

const idSchema = z.string().min(1);
const categorySchema = z.enum(["CHARACTER", "LOCATION", "ITEM"]);
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is limited to ${max.toLocaleString("en-US")} characters.`)
    .optional();

const sheetFieldSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(500),
});

const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Give the entry a name.").max(120, "Keep the name under 120 characters."),
  category: categorySchema,
  summary: optionalText(200, "The summary"),
  description: optionalText(20_000, "The description"),
  aliases: optionalText(300, "Aliases"),
  avatarUrl: z
    .string()
    .trim()
    .max(2_000)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "Avatar must be an http(s) URL.")
    .optional(),
  sheetFields: z.array(sheetFieldSchema).max(12, "Twelve fields is plenty for one sheet.").optional(),
});


const createSchema = fieldsSchema.extend({ novelId: idSchema });
const updateSchema = fieldsSchema.partial().extend({ id: idSchema });
const deleteSchema = z.object({ id: idSchema });

type Fields = z.output<typeof fieldsSchema>;

function toData(fields: Partial<Fields>) {
  const data: Record<string, unknown> = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.summary !== undefined) data.summary = fields.summary || null;
  if (fields.description !== undefined) data.description = fields.description || null;
  if (fields.aliases !== undefined) data.aliases = fields.aliases || null;
  if (fields.avatarUrl !== undefined) data.avatarUrl = fields.avatarUrl || null;
  if (fields.sheetFields !== undefined) data.sheetFields = fields.sheetFields.length ? JSON.stringify(fields.sheetFields) : null;
  return data;
}

function toCard(entry: {
  id: string;
  name: string;
  category: "CHARACTER" | "LOCATION" | "ITEM";
  summary: string | null;
  description: string | null;
  avatarUrl: string | null;
  aliases: string | null;
  sheetFields: string | null;
}): CodexEntryCard {
  return { ...entry, sheetFields: parseSheetFields(entry.sheetFields), chapterCount: 0, mentionedIn: [] };
}

function revalidateWorkspace() {
  revalidatePath("/", "layout");
}

/** Creates a codex entry. Also used by the editor's @ popover, which passes just a name and category. */
export async function createCodexEntry(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ entry: CodexEntryCard }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid entry.");
  const { novelId, ...fields } = parsed.data;

  const auth = await authorizeNovel(novelId);
  if (!auth.ok) return auth;

  const entry = await prisma.codexEntry.create({
    data: { novelId, name: fields.name, category: fields.category, ...toData(fields) },
  });
  revalidateWorkspace();
  return { ok: true, entry: toCard(entry) };
}

export async function updateCodexEntry(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<{ entry: CodexEntryCard }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid entry.");
  const { id, ...fields } = parsed.data;

  const auth = await authorizeCodexEntry(id);
  if (!auth.ok) return auth;

  try {
    const entry = await prisma.codexEntry.update({ where: { id }, data: toData(fields) });
    revalidateWorkspace();
    return { ok: true, entry: toCard(entry) };
  } catch {
    return fail("That entry no longer exists.");
  }
}

/** Deletes an entry and its mention index rows. Mentions in chapter text stay as plain tags. */
export async function deleteCodexEntry(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (parsed.success) {
    const auth = await authorizeCodexEntry(parsed.data.id);
    if (!auth.ok) return auth;
  }
  if (!parsed.success) return fail("That delete could not be understood.");
  try {
    await prisma.codexEntry.delete({ where: { id: parsed.data.id } });
  } catch {
    return fail("That entry no longer exists.");
  }
  revalidateWorkspace();
  return { ok: true };
}
