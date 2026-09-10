"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { Bold, BookMarked, Italic, Strikethrough, Underline } from "lucide-react";

import { placeFloating } from "@/lib/editor/floating";
import { cn } from "@/lib/utils";
import { useCodex } from "@/components/codex/codex-provider";
import { Surface } from "@/components/ui/surface";

/** A name is short, and it does not run past the end of a sentence. */
const MAX_CODEX_NAME_WORDS = 5;

function looksLikeName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > MAX_CODEX_NAME_WORDS) return false;
  return /[\p{L}]/u.test(trimmed) && !/[.!?;:]$/.test(trimmed);
}

/**
 * The selection menu.
 *
 * It exists for two reasons. The formatting toolbar is a fixed bar a writer has to travel to,
 * and — the one the user asked for — this is where a name you have already written becomes a
 * codex entry. Highlight "Kimian Roth", press Add to codex, and the entry opens pre-filled.
 * Nothing in the manuscript changes: linking the text is a separate, deliberate act.
 *
 * Written by hand rather than with the bubble-menu extension so it can decide *what* to offer
 * from the selected text, and so `onMouseDown` preventDefault keeps the selection alive — a
 * button that steals focus would collapse the very selection it acts on.
 */
export function SelectionMenu({ editor, root }: { editor: Editor | null; root: HTMLElement | null }) {
  const { openCreate } = useCodex();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<{ text: string; marks: Record<string, boolean> } | null>(null);

  React.useEffect(() => {
    if (!editor || !root) return;

    let frame = 0;

    const place = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      placeFloating(menu, rect, { offset: 8, preferAbove: true });
    };

    const sync = () => {
      const { state: view, isFocused } = editor;
      const { empty, from, to } = view.selection;
      if (empty || !isFocused) {
        setState(null);
        return;
      }
      const text = view.doc.textBetween(from, to, " ");
      if (!text.trim()) {
        setState(null);
        return;
      }
      setState({
        text,
        marks: {
          bold: editor.isActive("bold"),
          italic: editor.isActive("italic"),
          underline: editor.isActive("underline"),
          strike: editor.isActive("strike"),
        },
      });
      // Position after the browser has laid the menu out, or it measures zero on first show.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };

    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    editor.on("blur", sync);
    editor.on("focus", sync);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
      editor.off("blur", sync);
      editor.off("focus", sync);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [editor, root]);

  if (!editor || !state) return null;

  const run = (command: () => void) => () => {
    command();
  };

  return (
    <Surface
      ref={menuRef}
      level="floating"
      tone="popover"
      role="toolbar"
      aria-label="Selection"
      className="fixed z-50 flex items-center gap-0.5 p-1 duration-state ease-out-quiet animate-in fade-in zoom-in-95"
      // Every control keeps the caret where it is; the selection is the thing being acted on.
      onMouseDown={(event) => event.preventDefault()}
    >
      <MenuButton label="Bold" active={state.marks.bold} onClick={run(() => editor.chain().focus().toggleBold().run())}>
        <Bold className="size-3.5" />
      </MenuButton>
      <MenuButton label="Italic" active={state.marks.italic} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
        <Italic className="size-3.5" />
      </MenuButton>
      <MenuButton
        label="Underline"
        active={state.marks.underline}
        onClick={run(() => editor.chain().focus().toggleUnderline().run())}
      >
        <Underline className="size-3.5" />
      </MenuButton>
      <MenuButton label="Strikethrough" active={state.marks.strike} onClick={run(() => editor.chain().focus().toggleStrike().run())}>
        <Strikethrough className="size-3.5" />
      </MenuButton>

      {looksLikeName(state.text) && (
        <>
          <span aria-hidden className="mx-1 h-4 w-px bg-divider" />
          <button
            type="button"
            onClick={() => openCreate({ name: state.text.trim() })}
            className="focus-ring-inset flex h-7 items-center gap-1.5 rounded-md bg-press/15 px-2 text-2xs font-medium text-press transition-colors duration-tint ease-state hover:bg-press/25"
          >
            <BookMarked className="size-3.5" />
            Add to codex
          </button>
        </>
      )}
    </Surface>
  );
}

function MenuButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-ring-inset flex size-7 items-center justify-center rounded-md transition-colors duration-tint ease-state",
        active ? "bg-press/15 text-press" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
