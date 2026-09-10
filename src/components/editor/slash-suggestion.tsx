"use client";

import type { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";

import { placeFloating } from "@/lib/editor/floating";
import { searchSlashItems, type SlashItem, type SlashSuggestion } from "@/lib/editor/slash-command";

import { SlashList, type SlashListHandle, type SlashListProps } from "./slash-list";

/**
 * Wires the `/` trigger to the block menu. The same lifecycle as the `@` popover, with two
 * differences that matter: `/` never matches across a space (a slash mid-sentence is almost
 * always a slash), and it only opens at the start of an empty-ish block, so writing "and/or"
 * does not summon a menu.
 */
export function createSlashSuggestion(): SlashSuggestion {
  return {
    char: "/",
    allowSpaces: false,
    startOfLine: false,

    allow: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      // Only where a block command makes sense: a text block, with nothing but the trigger
      // between the block start and the caret.
      if (!$from.parent.isTextblock) return false;
      const before = $from.parent.textBetween(0, Math.max(0, $from.parentOffset - 1), undefined, "￼");
      return before.trim().length === 0;
    },

    items: ({ query }) => (query.length > 24 ? [] : searchSlashItems(query)),

    command: ({ editor, range, props }) => {
      (props as SlashItem).run(editor as Editor, range);
    },

    render: () => {
      let renderer: ReactRenderer<SlashListHandle, SlashListProps> | null = null;
      let anchor: (() => DOMRect | null) | null | undefined = null;
      let dismissed = false;

      const reposition = () => {
        const rect = anchor?.();
        if (renderer && rect) placeFloating(renderer.element, rect, { offset: 6 });
      };

      return {
        onStart: (props) => {
          if (!props.clientRect) return;
          anchor = props.clientRect;
          dismissed = false;
          renderer = new ReactRenderer(SlashList, {
            editor: props.editor as Editor,
            props: { query: props.query, onPick: (item: SlashItem) => props.command(item) },
          });
          renderer.element.style.zIndex = "50";
          document.body.appendChild(renderer.element);
          reposition();
          window.addEventListener("scroll", reposition, true);
          window.addEventListener("resize", reposition);
        },

        onUpdate: (props) => {
          if (!renderer || dismissed) return;
          anchor = props.clientRect;
          renderer.updateProps({ query: props.query, onPick: (item: SlashItem) => props.command(item) });
          reposition();
        },

        onKeyDown: (props) => {
          // Escape closes the menu and leaves the "/" alone, so it can be typed literally.
          if (props.event.key === "Escape") {
            if (!renderer || dismissed) return false;
            dismissed = true;
            renderer.element.style.display = "none";
            return true;
          }
          if (dismissed) return false;
          return renderer?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit: () => {
          window.removeEventListener("scroll", reposition, true);
          window.removeEventListener("resize", reposition);
          renderer?.element.remove();
          renderer?.destroy();
          renderer = null;
          anchor = null;
        },
      };
    },
  };
}
