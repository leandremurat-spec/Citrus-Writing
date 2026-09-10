import type { DocNode } from "@/lib/editor/word-count";

import { cleanText, normalizeBlocks, tidyOutput } from "./clean";
import type { ExportOptions } from "./types";

/**
 * Clean, webnovel-ready HTML: the narrow tag set Royal Road, Scribble Hub, and friends accept
 * without rewriting. No classes, no inline styles, no data attributes, no wrapper divs — just
 * the tags a reader's browser needs.
 */
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ESCAPES[char]);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

/** Inline content: text with its marks, mentions, and line breaks. */
function renderInline(nodes: readonly DocNode[] | undefined): string {
  return (nodes ?? []).map(renderInlineNode).join("");
}

function renderInlineNode(node: DocNode): string {
  if (node.type === "hardBreak") return "<br />\n";
  // A codex @mention is a writing aid, not something readers should see tagged: the entry's
  // name is what belongs in the published text.
  if (node.type === "mention") {
    return escapeHtml(cleanText(String(node.attrs?.label ?? node.attrs?.id ?? "")));
  }
  if (node.type !== "text") return renderInline(node.content);

  let html = escapeHtml(cleanText(node.text ?? ""));
  // Innermost first, so the resulting nesting reads naturally.
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        html = href ? `<a href="${escapeAttribute(href)}">${html}</a>` : html;
        break;
      }
    }
  }
  return html;
}

/**
 * A list item's contents.
 *
 * The schema is `paragraph block*`, so an item can hold more than one paragraph — a paste
 * from a word processor is the usual way it happens, which is exactly the case this engine
 * exists to clean up after. Only the single-paragraph item is unwrapped, and the decision is
 * made on the node tree rather than by rewriting the rendered string: the string-level regex
 * this replaces matched lazily as far as the next `</p></li>`, so a two-paragraph item came
 * out as `<li>first</p><p>second</li>` — a stray closing tag and an unclosed opening one.
 */
function renderListItem(item: DocNode, options: ExportOptions): string {
  const children = item.content ?? [];
  if (children.length === 1 && children[0].type === "paragraph") {
    return renderInline(children[0].content).trim();
  }
  return children.map((child) => renderBlock(child, options)).join("");
}

function renderBlock(node: DocNode, options: ExportOptions): string {
  switch (node.type) {
    case "paragraph": {
      const inner = renderInline(node.content).trim();
      // An empty paragraph is a deliberate beat of space; <br /> survives more sites than
      // an empty <p>, which many strip.
      return inner ? `<p>${inner}</p>` : "<p><br /></p>";
    }
    case "heading": {
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level ?? 2)));
      return `<h${level}>${renderInline(node.content).trim()}</h${level}>`;
    }
    case "blockquote":
      return `<blockquote>\n${(node.content ?? []).map((child) => renderBlock(child, options)).join("\n")}\n</blockquote>`;
    case "bulletList":
    case "orderedList": {
      const tag = node.type === "bulletList" ? "ul" : "ol";
      const items = (node.content ?? []).map((item) => `  <li>${renderListItem(item, options)}</li>`).join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "horizontalRule":
      return options.sceneBreak === "asterisks" ? "<p>* * *</p>" : "<hr />";
    default:
      return node.content ? renderInline(node.content) : "";
  }
}

export function toHtml(doc: DocNode | null, options: ExportOptions): string {
  const blocks = normalizeBlocks(doc).map((block) => renderBlock(block, options));
  if (options.includeTitle && options.title.trim()) {
    blocks.unshift(`<h2>${escapeHtml(cleanText(options.title.trim()))}</h2>`);
  }
  return tidyOutput(blocks.join("\n"));
}
