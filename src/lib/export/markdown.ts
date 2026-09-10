import type { DocNode } from "@/lib/editor/word-count";

import { cleanText, normalizeBlocks, tidyOutput } from "./clean";
import type { ExportOptions } from "./types";

/**
 * CommonMark output. Prose is escaped only where a character would otherwise be read as
 * formatting, so ordinary punctuation survives untouched.
 */

/** `*` and `_` can start emphasis; `[` and `]` can start a link; `\` escapes. */
const INLINE_SPECIALS = /([\\*_[\]`])/g;
/** A line that would be read as a heading, quote, list item, or thematic break. */
const LINE_START = /^(\s*)([-+*>#]|\d+[.)])(\s)/;

function escapeMarkdown(text: string): string {
  return cleanText(text).replace(INLINE_SPECIALS, "\\$1");
}

/**
 * A link destination, in the spelling CommonMark can read back.
 *
 * A bare destination may not contain spaces, and its parentheses must balance — neither of
 * which a writer controls, because `autolink` turns a typed URL into a link on its own. The
 * pointy-bracket form takes anything except `<`, `>` and a newline, which only have to be
 * percent-encoded, so it is the safe spelling whenever the plain one would not survive.
 */
function linkDestination(href: string): string {
  const clean = cleanText(href).replace(/</g, "%3C").replace(/>/g, "%3E");
  // Balanced parentheses are legal bare, but renderers disagree about them often enough that
  // any parenthesis is reason enough to reach for the form that cannot be misread.
  return /[\s()]/.test(clean) ? `<${clean}>` : clean;
}

function escapeLineStarts(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(LINE_START, (_match, indent, token, space) => `${indent}\\${token}${space}`))
    .join("\n");
}

function renderInline(nodes: readonly DocNode[] | undefined): string {
  return (nodes ?? []).map(renderInlineNode).join("");
}

function renderInlineNode(node: DocNode): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "mention") return escapeMarkdown(String(node.attrs?.label ?? node.attrs?.id ?? ""));
  if (node.type !== "text") return renderInline(node.content);

  let text = escapeMarkdown(node.text ?? "");
  if (!text) return text;

  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`;
        break;
      case "italic":
        text = `*${text}*`;
        break;
      case "strike":
        text = `~~${text}~~`;
        break;
      // CommonMark has no underline; inline HTML is the portable spelling.
      case "underline":
        text = `<u>${text}</u>`;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        text = href ? `[${text}](${linkDestination(href)})` : text;
        break;
      }
    }
  }
  return text;
}

function renderBlock(node: DocNode, options: ExportOptions, depth = 0): string {
  switch (node.type) {
    case "paragraph":
      return escapeLineStarts(renderInline(node.content).trim());
    case "heading": {
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level ?? 2)));
      return `${"#".repeat(level)} ${renderInline(node.content).trim()}`;
    }
    case "blockquote":
      return (node.content ?? [])
        .map((child) => renderBlock(child, options, depth))
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "bulletList":
    case "orderedList": {
      const indent = "  ".repeat(depth);
      return (node.content ?? [])
        .map((item, index) => {
          const marker = node.type === "bulletList" ? "-" : `${index + 1}.`;
          const body = (item.content ?? [])
            .map((child) => renderBlock(child, options, depth + 1))
            .join("\n\n")
            .split("\n")
            .map((line, lineIndex) => (lineIndex === 0 ? line : `${indent}   ${line}`))
            .join("\n");
          return `${indent}${marker} ${body}`;
        })
        .join("\n");
    }
    case "horizontalRule":
      return options.sceneBreak === "asterisks" ? "\\* \\* \\*" : "---";
    default:
      return node.content ? renderInline(node.content) : "";
  }
}

export function toMarkdown(doc: DocNode | null, options: ExportOptions): string {
  const blocks = normalizeBlocks(doc).map((block) => renderBlock(block, options));
  if (options.includeTitle && options.title.trim()) {
    blocks.unshift(`## ${cleanText(options.title.trim())}`);
  }
  return tidyOutput(blocks.join("\n\n"), { keepHardBreaks: true });
}
