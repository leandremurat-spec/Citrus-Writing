import type { DocNode } from "@/lib/editor/word-count";

/** Codex entry ids mentioned in a document, with how many times each appears. */
export function mentionsInDoc(node: DocNode, counts = new Map<string, number>()): Map<string, number> {
  if (node.type === "mention") {
    const id = node.attrs?.id;
    if (typeof id === "string" && id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const child of node.content ?? []) mentionsInDoc(child, counts);
  return counts;
}
