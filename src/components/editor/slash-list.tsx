"use client";

import * as React from "react";

import { searchSlashItems, type SlashItem } from "@/lib/editor/slash-command";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/ui/surface";

export interface SlashListProps {
  query: string;
  onPick: (item: SlashItem) => void;
}

export interface SlashListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * The `/` menu. Deliberately the same shape as the `@` list — arrow keys move, Enter picks,
 * focus never leaves the manuscript — so the two triggers feel like one mechanism.
 */
export const SlashList = React.forwardRef<SlashListHandle, SlashListProps>(function SlashList(
  { query, onPick },
  ref,
) {
  const items = React.useMemo(() => searchSlashItems(query), [query]);
  const [selected, setSelected] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const clamped = items.length === 0 ? 0 : Math.min(selected, items.length - 1);

  React.useEffect(() => setSelected(0), [query]);

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  React.useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        setSelected((current) => (current + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((current) => (current - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        onPick(items[clamped]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <Surface
      ref={listRef}
      level="floating"
      tone="popover"
      role="listbox"
      aria-label="Insert"
      className="max-h-72 w-60 overflow-y-auto p-1.5 text-popover-foreground"
    >
      {items.map((item, index) => {
        const active = index === clamped;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={active}
            data-selected={active}
            // Keep the caret in the manuscript: never let the button take focus.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setSelected(index)}
            onClick={() => onPick(item)}
            className={cn(
              "flex w-full items-baseline gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-tint ease-state",
              active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
            )}
          >
            <span className="text-sm">{item.title}</span>
            <span className="ml-auto text-2xs text-subtle">{item.hint}</span>
          </button>
        );
      })}
    </Surface>
  );
});
