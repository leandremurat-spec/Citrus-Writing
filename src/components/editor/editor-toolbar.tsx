"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PanelChrome } from "@/components/ui/panel-chrome";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A slim formatting bar. Keyboard shortcuts and markdown-style input rules do the same jobs. */
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            underline: instance.isActive("underline"),
            strike: instance.isActive("strike"),
            h2: instance.isActive("heading", { level: 2 }),
            h3: instance.isActive("heading", { level: 3 }),
            blockquote: instance.isActive("blockquote"),
            bulletList: instance.isActive("bulletList"),
            orderedList: instance.isActive("orderedList"),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo(),
          }
        : null,
  });

  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (!editor) return;
    command(editor.chain().focus()).run();
  };

  return (
    <PanelChrome role="toolbar" aria-label="Formatting" className="gap-0.5 bg-chrome px-3">
      <ToolbarButton label="Undo" shortcut="Ctrl+Z" disabled={!state?.canUndo} onClick={() => run((c) => c.undo())}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label="Redo" shortcut="Ctrl+Y" disabled={!state?.canRedo} onClick={() => run((c) => c.redo())}>
        <Redo2 />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1.5 h-4" />
      <ToolbarButton label="Bold" shortcut="Ctrl+B" active={state?.bold} onClick={() => run((c) => c.toggleBold())}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Italic" shortcut="Ctrl+I" active={state?.italic} onClick={() => run((c) => c.toggleItalic())}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        shortcut="Ctrl+U"
        active={state?.underline}
        onClick={() => run((c) => c.toggleUnderline())}
      >
        <Underline />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        shortcut="Ctrl+Shift+S"
        active={state?.strike}
        onClick={() => run((c) => c.toggleStrike())}
      >
        <Strikethrough />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1.5 h-4" />
      <ToolbarButton
        label="Scene title"
        shortcut="## "
        active={state?.h2}
        onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
      >
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        shortcut="### "
        active={state?.h3}
        onClick={() => run((c) => c.toggleHeading({ level: 3 }))}
      >
        <Heading3 />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        shortcut="> "
        active={state?.blockquote}
        onClick={() => run((c) => c.toggleBlockquote())}
      >
        <TextQuote />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        shortcut="- "
        active={state?.bulletList}
        onClick={() => run((c) => c.toggleBulletList())}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        shortcut="1. "
        active={state?.orderedList}
        onClick={() => run((c) => c.toggleOrderedList())}
      >
        <ListOrdered />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1.5 h-4" />
      <ToolbarButton label="Scene break" shortcut="---" onClick={() => run((c) => c.setHorizontalRule())}>
        <Minus />
      </ToolbarButton>
    </PanelChrome>
  );
}

function ToolbarButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            data-active={active ? "" : undefined}
            className={cn("text-muted-foreground", "data-active:bg-press/15 data-active:text-press")}
            // Keep the editor selection: don't move focus to the button on click.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <kbd className="ml-1 rounded bg-background/20 px-1 font-mono text-3xs">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
