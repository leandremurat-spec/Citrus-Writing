import type { DocNode } from "@/lib/editor/word-count";

import { cleanText, normalizeBlocks, tidyOutput } from "./clean";
import type { ExportOptions } from "./types";

/**
 * Plain text: the third format the landing page and the pricing table both promise, and the
 * one this engine did not have.
 *
 * It is not "Markdown without the asterisks". Markdown escapes characters *so that* they
 * survive a parser; plain text has no parser, so escaping would be actively wrong — a writer
 * pasting into a plain box wants their asterisks and underscores exactly as typed. Every
 * escape rule is therefore dropped rather than adapted, which is why this is its own renderer
 * and not a flag on the Markdown one.
 *
 * What it keeps is *structure that survives without markup*: blank lines between paragraphs,
 * a bullet or a number in front of a list item, and a scene break drawn the way the writer
 * chose. What it loses is emphasis, which is the honest trade — a plain-text asterisk around
 * a word is markup pretending not to be.
 */

/** Where a link's destination is worth keeping beside its text. */
function linkSuffix(href: string, text: string): string {
  const clean = cleanText(href).trim();
  if (!clean) return "";
  // An autolinked URL renders as its own href; repeating it would read as a stutter. The
  // comparison is loose because the editor's autolink adds a scheme the typed text may lack.
  const bare = clean.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const shown = text.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return bare === shown ? "" : " (" + clean + ")";
}

function renderInline(nodes: readonly DocNode[] | undefined): string {
  return (nodes ?? []).map(renderInlineNode).join("");
}

function renderInlineNode(node: DocNode): string {
  if (node.type === "hardBreak") return "\n";
  // The @ goes, the name stays — the same rule every format here follows. A mention is a
  // writing aid, not something a reader should meet.
  if (node.type === "mention") return cleanText(String(node.attrs?.label ?? node.attrs?.id ?? ""));
  if (node.type !== "text") return renderInline(node.content);

  const text = cleanText(node.text ?? "");
  const link = (node.marks ?? []).find((mark) => mark.type === "link");
  return link ? text + linkSuffix(String(link.attrs?.href ?? ""), text) : text;
}

function renderBlock(node: DocNode, options: ExportOptions, depth = 0): string {
  const indent = "    ".repeat(depth);

  switch (node.type) {
    case "paragraph":
      return renderInline(node.content).trim();

    // A heading has no way to announce itself in plain text, so it is simply its own line.
    // Uppercasing it would be a decision about the writer's prose, not a format conversion.
    case "heading":
      return renderInline(node.content).trim();

    case "blockquote":
      return (node.content ?? [])
        .map((child) => renderBlock(child, options, depth))
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? "    " + line : ""))
        .join("\n");

    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => {
          const marker = node.type === "bulletList" ? "• " : index + 1 + ". ";
          const body = (item.content ?? [])
            .map((child) => renderBlock(child, options, depth + 1))
            .join("\n\n")
            .split("\n")
            // Continuation lines line up under the text, not under the marker.
            .map((line, lineIndex) => (lineIndex === 0 ? line : indent + " ".repeat(marker.length) + line))
            .join("\n");
          return indent + marker + body;
        })
        .join("\n");

    case "horizontalRule":
      return options.sceneBreak === "asterisks" ? "* * *" : "———";

    default:
      return node.content ? renderInline(node.content) : "";
  }
}

export function toPlainText(doc: DocNode | null, options: ExportOptions): string {
  const blocks = normalizeBlocks(doc).map((block) => renderBlock(block, options));
  if (options.includeTitle && options.title.trim()) {
    blocks.unshift(cleanText(options.title.trim()));
  }
  // No `keepHardBreaks`: two trailing spaces mean nothing here, so they are just whitespace.
  return tidyOutput(blocks.join("\n\n"));
}
