/** Client-safe shapes for codex data. The server maps Prisma rows into these. */

import type { SheetField } from "./sheet-fields";

export type CodexCategory = "CHARACTER" | "LOCATION" | "ITEM";

export interface CodexBacklink {
  chapterId: string;
  title: string;
  mentionCount: number;
}

export interface CodexEntryCard {
  id: string;
  name: string;
  category: CodexCategory;
  summary: string | null;
  description: string | null;
  avatarUrl: string | null;
  aliases: string | null;
  sheetFields: SheetField[];
  /** Number of chapters that mention this entry. */
  chapterCount: number;
  /** Chapters that mention this entry, most mentions first. */
  mentionedIn: CodexBacklink[];
}

export interface ChapterMention {
  codexEntryId: string;
  mentionCount: number;
}

export const CODEX_CATEGORIES: readonly CodexCategory[] = ["CHARACTER", "LOCATION", "ITEM"];

export const CODEX_CATEGORY_LABEL: Record<CodexCategory, { singular: string; plural: string }> = {
  CHARACTER: { singular: "Character", plural: "Characters" },
  LOCATION: { singular: "Location", plural: "Locations" },
  ITEM: { singular: "Item", plural: "Items" },
};

export function isCodexCategory(value: unknown): value is CodexCategory {
  return typeof value === "string" && (CODEX_CATEGORIES as readonly string[]).includes(value);
}

/** Splits the comma-separated alias field into clean names. */
export function splitAliases(aliases: string | null | undefined): string[] {
  return (aliases ?? "")
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);
}
