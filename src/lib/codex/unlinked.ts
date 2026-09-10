import type { DocNode } from "@/lib/editor/word-count";

/**
 * Finding a codex entry's name where it is written as ordinary text.
 *
 * The problem this solves: an entry created *after* the name was already in the manuscript
 * knows nothing about the sentences that mention it. The @ popover only links what you type
 * from now on.
 *
 * Nothing here changes a document. It reports positions; linking is a separate, deliberate
 * act, because rewriting someone's prose on a match is not a thing to do quietly — a name
 * like "Bell" would tag every bell in the book, and there is no version history to undo it.
 */

export interface UnlinkedHit {
  /** Character offset within the concatenated text of the block that holds it. */
  index: number;
  length: number;
  /** The surrounding sentence fragment, for the review list. */
  excerpt: string;
}

const EXCERPT_PAD = 34;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A word-boundary pattern for the entry's name and every alias, longest first so "Wren
 * Ashcombe" wins over "Wren" and the two do not both claim the same words.
 */
export function namePattern(names: readonly string[]): RegExp | null {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter((name) => name.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  if (cleaned.length === 0) return null;
  // \b would not fire beside an apostrophe or a hyphen inside a name, so the boundaries are
  // written out: not preceded or followed by a letter, digit, or the `@` of a live mention.
  return new RegExp(`(?<![\\p{L}\\p{N}@])(${cleaned.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

/** Every plain-text occurrence in the document. Mention nodes hold no text, so they never match. */
export function findUnlinked(doc: DocNode | null, pattern: RegExp | null): UnlinkedHit[] {
  if (!doc || !pattern) return [];
  const hits: UnlinkedHit[] = [];

  const walk = (node: DocNode) => {
    if (node.type === "text" && typeof node.text === "string") {
      const text = node.text;
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const index = match.index ?? 0;
        hits.push({
          index,
          length: match[0].length,
          excerpt: buildExcerpt(text, index, match[0].length),
        });
      }
      return;
    }
    for (const child of node.content ?? []) walk(child);
  };

  walk(doc);
  return hits;
}

function buildExcerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - EXCERPT_PAD);
  const end = Math.min(text.length, index + length + EXCERPT_PAD);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
