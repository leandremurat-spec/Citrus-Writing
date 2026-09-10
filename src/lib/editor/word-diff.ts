/**
 * Words added and removed between two versions of a text, as a multiset difference.
 *
 * Tokens follow the same rule as the word count (a whitespace-separated token with at least
 * one letter or digit), then are normalised for comparison: lower-cased, with surrounding
 * punctuation stripped. So fixing a comma or a capital letter is not a word change, while
 * swapping "cat" for "dog" counts as one removed and one added. Moving a paragraph counts as
 * nothing, because the bag of words is the same.
 *
 * Because every token lands in the bag, `added - removed` always equals the change in the
 * word count between the two texts.
 */
const WORD_TOKEN = /[\p{L}\p{N}]/u;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export type WordBag = Map<string, number>;

export function wordBag(text: string): WordBag {
  const bag: WordBag = new Map();
  for (const raw of text.split(/\s+/)) {
    if (!raw || !WORD_TOKEN.test(raw)) continue;
    const token = raw.toLowerCase().replace(EDGE_PUNCTUATION, "");
    bag.set(token, (bag.get(token) ?? 0) + 1);
  }
  return bag;
}

export interface WordDiff {
  added: number;
  removed: number;
}

export function diffWordBags(before: WordBag, after: WordBag): WordDiff {
  let added = 0;
  let removed = 0;
  for (const [token, count] of after) {
    const previous = before.get(token) ?? 0;
    if (count > previous) added += count - previous;
  }
  for (const [token, count] of before) {
    const next = after.get(token) ?? 0;
    if (count > next) removed += count - next;
  }
  return { added, removed };
}

export function diffWords(beforeText: string, afterText: string): WordDiff {
  return diffWordBags(wordBag(beforeText), wordBag(afterText));
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${value.toLocaleString("en-US")}`;
  if (value < 0) return `−${Math.abs(value).toLocaleString("en-US")}`;
  return "0";
}
