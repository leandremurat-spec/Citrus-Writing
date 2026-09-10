"use client";

import type { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";

import type { CodexCategory, CodexEntryCard } from "@/lib/codex/types";
import { placeFloating } from "@/lib/editor/floating";

import { MentionList, type MentionListHandle, type MentionListProps } from "./mention-list";

export interface MentionSuggestionDeps {
  /** Always the current codex; read through a ref so the extension never has to be rebuilt. */
  getEntries: () => readonly CodexEntryCard[];
  createEntry: (name: string, category: CodexCategory) => Promise<CodexEntryCard | null>;
}

type Selected = { id: string; label: string };

/**
 * Wires the `@` trigger to a floating list of codex entries. Filtering happens in the
 * component (see `buildItems`), so `items` just hands the query through.
 */
export function createMentionSuggestion(deps: MentionSuggestionDeps): Omit<SuggestionOptions<CodexEntryCard, Selected>, "editor"> {
  return {
    char: "@",
    // Names contain spaces ("Wren Ashcombe"), but runaway matching would swallow whole
    // sentences; the list simply stops matching once the query gets long.
    allowSpaces: true,
    items: ({ query }) => (query.length > 60 ? [] : [...deps.getEntries()]),

    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "mention", attrs: { id: props.id, label: props.label } },
          { type: "text", text: " " },
        ])
        .run();
    },

    render: () => {
      let renderer: ReactRenderer<MentionListHandle, MentionListProps> | null = null;
      let anchor: (() => DOMRect | null) | null | undefined = null;
      /** Set by Escape: stay quiet until the next `@`. */
      let dismissed = false;
      /** Captured on open: the keydown callback is not given the editor. */
      let host: Editor | null = null;

      const reposition = () => {
        const rect = anchor?.();
        if (renderer && rect) placeFloating(renderer.element, rect, { offset: 6 });
      };

      /*
       * The editor is the combobox. Focus deliberately never leaves it — moving focus to the
       * list would collapse the caret — so the list has to be described from here instead:
       * aria-expanded says it is open, aria-controls names it, aria-activedescendant follows
       * the highlighted row. Without these the popover was invisible to assistive tech.
       */
      const describe = (editor: Editor, expanded: boolean) => {
        const dom = editor.view.dom;
        if (!expanded) {
          dom.removeAttribute("aria-expanded");
          dom.removeAttribute("aria-controls");
          dom.removeAttribute("aria-activedescendant");
          return;
        }
        dom.setAttribute("aria-expanded", "true");
        dom.setAttribute("aria-controls", "mention-list");
        const active = renderer?.element.querySelector<HTMLElement>('[data-selected="true"]');
        if (active?.id) dom.setAttribute("aria-activedescendant", active.id);
        else dom.removeAttribute("aria-activedescendant");
      };

      return {
        onStart: (props) => {
          if (!props.clientRect) return;
          anchor = props.clientRect;
          dismissed = false;
          host = props.editor as Editor;
          renderer = new ReactRenderer(MentionList, {
            editor: props.editor as Editor,
            props: {
              entries: deps.getEntries(),
              query: props.query,
              onPick: props.command,
              onCreate: deps.createEntry,
            },
          });
          renderer.element.style.zIndex = "50";
          document.body.appendChild(renderer.element);
          reposition();
          describe(props.editor as Editor, true);
          window.addEventListener("scroll", reposition, true);
          window.addEventListener("resize", reposition);
        },

        onUpdate: (props) => {
          if (!renderer || dismissed) return;
          anchor = props.clientRect;
          renderer.updateProps({
            entries: deps.getEntries(),
            query: props.query,
            onPick: props.command,
            onCreate: deps.createEntry,
          });
          reposition();
          describe(props.editor as Editor, true);
        },

        onKeyDown: (props) => {
          // Escape closes the list but leaves the text alone, so "@" can be typed literally.
          if (props.event.key === "Escape") {
            if (!renderer || dismissed) return false;
            dismissed = true;
            renderer.element.style.display = "none";
            return true;
          }
          if (dismissed) return false;
          const handled = renderer?.ref?.onKeyDown(props.event) ?? false;
          // The list re-renders after the key, so read the new selection on the next frame.
          if (handled && host) requestAnimationFrame(() => host && describe(host, true));
          return handled;
        },

        onExit: () => {
          if (host) describe(host, false);
          host = null;
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
