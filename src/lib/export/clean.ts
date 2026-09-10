import type { DocNode } from "@/lib/editor/word-count";

/**
 * The tidying pass every export shares.
 *
 * The editor's schema is already the first line of defence: pasting from Google Docs or Word
 * drops unknown spans, styles, and classes on the way in, so nothing exotic reaches storage.
 * What survives such a paste is subtler: non-breaking spaces, zero-width characters, stray
 * trailing whitespace, and runs of empty paragraphs used as spacing. Serial platforms render
 * all of those badly, so they are cleaned here rather than in each format.
 */

// Built from code points rather than written as literals: an invisible character pasted into
// source cannot be reviewed, and is easily mangled by an editor or a diff.
const charClass = (...codePoints: number[]) =>
  new RegExp(`[${codePoints.map((point) => String.fromCharCode(point)).join("")}]`, "g");

/** Non-breaking space, narrow no-break space, figure space, word joiner. */
const NBSP = charClass(0x00a0, 0x202f, 0x2007, 0x2060);
/** Soft hyphen, zero-width space / non-joiner / joiner, byte-order mark. */
const INVISIBLE = charClass(0x00ad, 0x200b, 0x200c, 0x200d, 0xfeff);
/** Two or more spaces at the end of a line: Markdown's hard-break marker. */
const TRAILING_DOUBLE_SPACE = /[ ]{2,}$/;
const TRAILING_WHITESPACE = /[ \t]+$/;

export function cleanText(text: string): string {
  return text.replace(NBSP, " ").replace(INVISIBLE, "");
}

function isEmptyBlock(node: DocNode): boolean {
  if (node.type !== "paragraph") return false;
  const content = node.content ?? [];
  if (content.length === 0) return true;
  return content.every((child) => child.type === "text" && cleanText(child.text ?? "").trim() === "");
}

/**
 * Top-level blocks with the padding removed: no leading or trailing blank paragraphs, and
 * never more than one blank paragraph in a row.
 */
export function normalizeBlocks(doc: DocNode | null): DocNode[] {
  const blocks = doc?.content ?? [];
  const kept: DocNode[] = [];
  for (const block of blocks) {
    if (isEmptyBlock(block)) {
      if (kept.length === 0) continue;
      if (isEmptyBlock(kept[kept.length - 1])) continue;
    }
    kept.push(block);
  }
  while (kept.length > 0 && isEmptyBlock(kept[kept.length - 1])) kept.pop();
  return kept;
}

/**
 * Collapses the blank lines left between blocks and trims trailing spaces.
 *
 * `keepHardBreaks` protects Markdown's one meaningful use of trailing whitespace: two spaces
 * at the end of a line are a hard break. Only a line with content and a non-empty line after
 * it can be one, so stray spaces elsewhere are still cleaned away.
 */
export function tidyOutput(text: string, options: { keepHardBreaks?: boolean } = {}): string {
  const lines = text.split("\n");
  return lines
    .map((line, index) => {
      const stripped = line.replace(TRAILING_WHITESPACE, "");
      if (!options.keepHardBreaks || stripped === "") return stripped;
      const isHardBreak = TRAILING_DOUBLE_SPACE.test(line) && (lines[index + 1] ?? "").trim() !== "";
      return isHardBreak ? `${stripped}  ` : stripped;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
