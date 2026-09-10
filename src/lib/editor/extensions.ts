import type { Extensions } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { Focus, Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import type { SuggestionOptions } from "@tiptap/suggestion";

import { SlashCommand, type SlashSuggestion } from "./slash-command";

/**
 * The manuscript editor's vocabulary. Kept deliberately small so the export engine (Step 5)
 * only has to understand what serial platforms accept: paragraphs, emphasis, a couple of
 * heading levels for scene titles, quotes, lists, scene breaks, links, and @mentions.
 */
export function createEditorExtensions(options: {
  /** The `@` popover. Omit for a plain editor (mentions still render, they just can't be typed). */
  mentionSuggestion?: Omit<SuggestionOptions, "editor">;
  /** The `/` block menu. Same Suggestion plumbing as `@`, different trigger. */
  slashSuggestion?: SlashSuggestion;
} = {}): Extensions {
  return [
    // Marks the block the caret is in with `.has-focus`, which is what "dim other
    // paragraphs" keys off. It changes no content and adds no node type, so the export
    // engine never sees it.
    Focus.configure({ className: "has-focus", mode: "shallowest" }),
    ...(options.slashSuggestion ? [SlashCommand.configure({ suggestion: options.slashSuggestion })] : []),
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      },
      dropcursor: { color: "var(--press)", width: 2 },
    }),
    Placeholder.configure({
      placeholder: "Begin the chapter…",
    }),
    Mention.configure({
      HTMLAttributes: { class: "mention" },
      deleteTriggerWithBackspace: true,
      ...(options.mentionSuggestion
        ? { suggestion: { decorationClass: "mention-suggestion", ...options.mentionSuggestion } }
        : {}),
    }),
  ];
}

/** Serializes @mentions the same way the server counts them ("@Label" is part of the text). */
export const MENTION_TEXT_SERIALIZERS = {
  mention: ({ node }: { node: { attrs: Record<string, unknown> } }) =>
    `@${String(node.attrs.label ?? node.attrs.id ?? "")}`,
};
