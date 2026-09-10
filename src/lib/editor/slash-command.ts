import { Extension, type Range } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

/**
 * `/` block commands, on the same Suggestion plumbing the `@` popover already uses. It is an
 * Extension rather than a Node: nothing is inserted into the document, the command simply
 * deletes the `/query` you typed and runs an ordinary editor command in its place. That keeps
 * the schema exactly as narrow as it was, so the export engine learns nothing new.
 */

export interface SlashItem {
  id: string;
  title: string;
  hint: string;
  /** Words that should also match, so "divider" finds the scene break. */
  keywords: readonly string[];
  run: (editor: Editor, range: Range) => void;
}

export type SlashSuggestion = Omit<SuggestionOptions<SlashItem>, "editor">;

export const SLASH_ITEMS: readonly SlashItem[] = [
  {
    id: "h2",
    title: "Scene title",
    hint: "Heading",
    keywords: ["heading", "h2", "title", "scene"],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    title: "Subheading",
    hint: "Smaller heading",
    keywords: ["heading", "h3", "sub"],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    id: "quote",
    title: "Quote",
    hint: "Set a passage apart",
    keywords: ["blockquote", "epigraph", "letter"],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "bullets",
    title: "Bullet list",
    hint: "For notes inside a draft",
    keywords: ["list", "ul", "unordered"],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "numbers",
    title: "Numbered list",
    hint: "Ordered steps",
    keywords: ["list", "ol", "ordered"],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "break",
    title: "Scene break",
    hint: "A rule between scenes",
    keywords: ["divider", "hr", "rule", "separator", "asterisk"],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

/** Name and hint rank above keywords, the same rule the codex search uses. */
export function searchSlashItems(query: string): SlashItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...SLASH_ITEMS];
  const starts: SlashItem[] = [];
  const contains: SlashItem[] = [];
  for (const item of SLASH_ITEMS) {
    const title = item.title.toLowerCase();
    if (title.startsWith(needle)) starts.push(item);
    else if (title.includes(needle) || item.keywords.some((word) => word.includes(needle))) contains.push(item);
  }
  return [...starts, ...contains];
}

export const SlashCommand = Extension.create<{ suggestion: SlashSuggestion }>({
  name: "slashCommand",

  addOptions() {
    return { suggestion: { char: "/" } as SlashSuggestion };
  },

  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});
