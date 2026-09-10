import { splitAliases, type CodexEntryCard } from "@/lib/codex/types";

/**
 * One matching rule for every place the codex is searched: the panel's search box and the
 * editor's @ popover. Names and aliases match first and rank highest, then summaries.
 */
export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Lower is better; `null` means no match. */
function rank(entry: CodexEntryCard, needle: string): number | null {
  const names = [entry.name, ...splitAliases(entry.aliases)].map(normalize);
  if (names.some((name) => name === needle)) return 0;
  if (names.some((name) => name.startsWith(needle))) return 1;
  // A word inside the name: "ashcombe" matches "Wren Ashcombe".
  if (names.some((name) => name.split(/\s+/).some((word) => word.startsWith(needle)))) return 2;
  if (names.some((name) => name.includes(needle))) return 3;
  if (normalize(entry.summary ?? "").includes(needle)) return 4;
  return null;
}

export function searchCodex(entries: readonly CodexEntryCard[], query: string): CodexEntryCard[] {
  const needle = normalize(query);
  if (!needle) return [...entries];
  return entries
    .map((entry) => ({ entry, score: rank(entry, needle) }))
    .filter((row): row is { entry: CodexEntryCard; score: number } => row.score !== null)
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .map((row) => row.entry);
}

/** True when an entry already carries this exact name or alias. */
export function hasExactName(entries: readonly CodexEntryCard[], query: string): boolean {
  const needle = normalize(query);
  return entries.some((entry) =>
    [entry.name, ...splitAliases(entry.aliases)].some((name) => normalize(name) === needle),
  );
}
