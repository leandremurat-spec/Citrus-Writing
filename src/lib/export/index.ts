import { countWordsInDoc, type DocNode } from "@/lib/editor/word-count";

import { normalizeBlocks } from "./clean";
import { toHtml } from "./html";
import { toMarkdown } from "./markdown";
import { toPlainText } from "./plain";
import type { ExportChapterItem, ExportChaptersOptions, ExportOptions, ExportResult } from "./types";

export * from "./types";
export { toHtml } from "./html";
export { toMarkdown } from "./markdown";
export { toPlainText } from "./plain";

/** Node types whose meaning cannot be carried over into a given format. */
function collectWarnings(doc: DocNode | null, options: ExportOptions): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const walk = (node: DocNode) => {
    seen.add(node.type);
    for (const mark of node.marks ?? []) seen.add(`mark:${mark.type}`);
    for (const child of node.content ?? []) walk(child);
  };
  if (doc) walk(doc);

  if (seen.has("mention")) {
    warnings.push("@mentions are exported as plain names, without the @.");
  }
  if (options.format === "markdown" && seen.has("mark:underline")) {
    warnings.push("Markdown has no underline, so those runs use <u> tags.");
  }
  if (options.format === "text") {
    const emphasis = ["mark:bold", "mark:italic", "mark:underline", "mark:strike"].some((mark) => seen.has(mark));
    if (emphasis) warnings.push("Plain text carries no emphasis, so bold and italics come out flat.");
    if (seen.has("mark:link")) warnings.push("Link addresses are kept in brackets after the words they were on.");
  }
  return warnings;
}

/** One renderer per format. A lookup rather than a chain of ternaries, so adding a fourth
    format is a line here and a file beside html.ts / markdown.ts / plain.ts. */
const RENDERERS = { html: toHtml, markdown: toMarkdown, text: toPlainText } as const;

/** Turns a stored chapter document into clipboard-ready output. */
export function exportChapter(doc: DocNode | null, options: ExportOptions): ExportResult {
  const text = RENDERERS[options.format](doc, options);
  const blocks = normalizeBlocks(doc);
  const counted: DocNode = { type: "doc", content: blocks };
  const bodyWords = countWordsInDoc(counted);
  const titleWords = options.includeTitle ? countWordsInDoc({ type: "text", text: options.title }) : 0;

  return {
    text,
    html: options.format === "html" ? text : null,
    wordCount: bodyWords + titleWords,
    characterCount: text.length,
    warnings: collectWarnings(doc, options),
  };
}

function sceneBreakMarker(options: ExportChaptersOptions): string {
  if (options.format === "html") return options.sceneBreak === "asterisks" ? "<p>* * *</p>" : "<hr />";
  // Plain text escapes nothing, so its asterisks are bare — and its rule is an em-dash run
  // rather than Markdown's three hyphens, which in plain text would just be three hyphens.
  if (options.format === "text") return options.sceneBreak === "asterisks" ? "* * *" : "———";
  return options.sceneBreak === "asterisks" ? "\\* \\* \\*" : "---";
}

/**
 * Concatenates several chapters into one export — an arc, a volume, or a whole serial in one
 * pass, which is how a serial author actually ships a backlog. Each chapter still goes through
 * `exportChapter` alone first, so the single-chapter engine above stays untouched; this only
 * decides what sits between the results.
 */
export function exportChapters(items: readonly ExportChapterItem[], options: ExportChaptersOptions): ExportResult {
  const perChapter = items.map((item) =>
    exportChapter(item.doc, {
      format: options.format,
      sceneBreak: options.sceneBreak,
      includeTitle: options.separator === "heading",
      title: item.title,
    }),
  );

  const blank = options.format === "html" ? "\n" : "\n\n";
  const marker = options.separator === "sceneBreak" ? sceneBreakMarker(options) : null;
  const text = marker
    ? perChapter.map((result) => result.text).join(`${blank}${marker}${blank}`)
    : perChapter.map((result) => result.text).join(blank);

  return {
    text,
    html: options.format === "html" ? text : null,
    wordCount: perChapter.reduce((sum, result) => sum + result.wordCount, 0),
    characterCount: text.length,
    warnings: [...new Set(perChapter.flatMap((result) => result.warnings))],
  };
}
