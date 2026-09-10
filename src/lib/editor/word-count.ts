/**
 * One definition of "a word" for the whole app: the editor footer, the binder, the server
 * action that persists chapters, and the seed all count the same way.
 *
 * A token is a word when it contains at least one letter or digit, so stray punctuation
 * ("—", "...", "*") never counts, while "salt-bitten" and "1,200" count once each.
 */
const WORD_TOKEN = /[\p{L}\p{N}]/u;

export function countWordsInText(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (token && WORD_TOKEN.test(token)) count++;
  }
  return count;
}

/** Minimal shape of a serialized ProseMirror / TipTap node. */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  /** Inline formatting on a text node: bold, italic, link, and friends. */
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** Plain text of a document: block boundaries become newlines, mentions become "@Label". */
export function docToPlainText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") return `@${String(node.attrs?.label ?? node.attrs?.id ?? "")}`;
  if (node.type === "hardBreak") return "\n";
  const inner = (node.content ?? []).map(docToPlainText);
  // Inline content is concatenated; block children are separated by newlines.
  const isBlockContainer = node.content?.some((child) => child.content !== undefined || child.type === "horizontalRule");
  return isBlockContainer ? inner.join("\n") : inner.join("");
}

export function countWordsInDoc(node: DocNode): number {
  return countWordsInText(docToPlainText(node));
}

/** Parses stored chapter content. Empty or malformed content counts as an empty document. */
export function parseDoc(content: string): DocNode | null {
  if (!content) return null;
  try {
    const doc = JSON.parse(content) as DocNode;
    return doc && typeof doc === "object" && doc.type === "doc" ? doc : null;
  } catch {
    return null;
  }
}
