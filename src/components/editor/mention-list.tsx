"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";

import { CODEX_CATEGORIES, type CodexCategory, type CodexEntryCard } from "@/lib/codex/types";
import { hasExactName, searchCodex } from "@/lib/codex/search";
import { cn } from "@/lib/utils";
import { CATEGORY_META, initials } from "@/components/codex/category-meta";
import { Surface } from "@/components/ui/surface";

/** How many existing entries the popover offers before the "create" rows. */
const MAX_MATCHES = 5;
/** Past this, the "@" was almost certainly incidental and the author is just writing. */
const MAX_QUERY_CHARS = 48;
const MAX_QUERY_WORDS = 6;

/** True once the query reads like prose rather than a name. */
export function queryIsProse(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length > MAX_QUERY_CHARS || trimmed.split(/\s+/).length > MAX_QUERY_WORDS;
}

export interface MentionItem {
  kind: "entry" | "create";
  entry?: CodexEntryCard;
  category?: CodexCategory;
  name?: string;
}

export interface MentionListHandle {
  /** Returns true when the key was handled and the editor should ignore it. */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export interface MentionListProps {
  entries: readonly CodexEntryCard[];
  query: string;
  /** Inserts the mention node into the document. */
  onPick: (entry: { id: string; label: string }) => void;
  /** Creates a new codex entry, returning it once saved. */
  onCreate: (name: string, category: CodexCategory) => Promise<CodexEntryCard | null>;
}

export function buildItems(entries: readonly CodexEntryCard[], query: string): MentionItem[] {
  if (queryIsProse(query)) return [];
  const name = query.trim();
  const matches = searchCodex(entries, name)
    .slice(0, MAX_MATCHES)
    .map((entry): MentionItem => ({ kind: "entry", entry }));
  if (!name || hasExactName(entries, name)) return matches;
  return [...matches, ...CODEX_CATEGORIES.map((category): MentionItem => ({ kind: "create", category, name }))];
}

/**
 * The popover shown while typing `@`. Arrow keys move, Enter or Tab picks, Escape closes.
 * Keyboard handling is driven by the editor through the imperative handle, so focus never
 * leaves the manuscript.
 */
export const MentionList = React.forwardRef<MentionListHandle, MentionListProps>(function MentionList(
  { entries, query, onPick, onCreate },
  ref,
) {
  const items = React.useMemo(() => buildItems(entries, query), [entries, query]);
  const [selected, setSelected] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  // A new query means a new list: start from the top again (adjusted during render, not in
  // an effect, so the highlight never flashes on the wrong row).
  const [lastQuery, setLastQuery] = React.useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setSelected(0);
  }
  // Keep the highlight in range while the list shrinks.
  const clamped = items.length === 0 ? 0 : Math.min(selected, items.length - 1);

  const choose = React.useCallback(
    async (index: number) => {
      const item = items[index];
      if (!item || creating) return;
      if (item.kind === "entry" && item.entry) {
        onPick({ id: item.entry.id, label: item.entry.name });
        return;
      }
      if (!item.name || !item.category) return;
      setCreating(true);
      const created = await onCreate(item.name, item.category);
      setCreating(false);
      if (created) onPick({ id: created.id, label: created.name });
    },
    [items, creating, onPick, onCreate],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (event) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSelected((current) => (current + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((current) => (current + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          void choose(clamped);
          return true;
        }
        return false;
      },
    }),
    [items, clamped, choose],
  );

  // Keep the highlighted row visible when arrowing through a long list.
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  // Once the query reads like a sentence, the "@" was incidental: get out of the way.
  if (items.length === 0 && queryIsProse(query)) return null;

  if (items.length === 0) {
    return (
      <Surface level="floating" tone="popover" className="w-72 p-3 text-xs text-muted-foreground">
        {entries.length === 0
          ? "Type a name to start your codex."
          : `No codex entries match “${query}”.`}
      </Surface>
    );
  }

  return (
    <Surface
      ref={listRef}
      level="floating"
      tone="popover"
      id="mention-list"
      role="listbox"
      aria-label="Codex entries"
      className="max-h-72 w-72 overflow-y-auto p-1.5 text-popover-foreground"
    >
      {items.map((item, index) => {
        const active = index === clamped;
        const key = item.kind === "entry" ? item.entry!.id : `create-${item.category}`;
        return (
          <button
            key={key}
            // The editor points at this id with aria-activedescendant: focus stays in the
            // manuscript, so the caret never moves, and a screen reader still follows the
            // highlighted entry.
            id={`mention-option-${index}`}
            type="button"
            role="option"
            aria-selected={active}
            data-selected={active}
            disabled={creating}
            // Keep the caret in the manuscript: never let the button take focus.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setSelected(index)}
            onClick={() => void choose(index)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-tint ease-state",
              active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
            )}
          >
            {item.kind === "entry" ? <EntryRow entry={item.entry!} /> : <CreateRow item={item} busy={creating && active} />}
          </button>
        );
      })}
    </Surface>
  );
});

function EntryRow({ entry }: { entry: CodexEntryCard }) {
  const meta = CATEGORY_META[entry.category];
  return (
    <>
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- author-supplied URLs, unoptimised on purpose
        <img src={entry.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold", meta.tint)}>
          {initials(entry.name)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{entry.name}</span>
        {entry.summary && <span className="block truncate text-xs text-muted-foreground">{entry.summary}</span>}
      </span>
      <meta.icon className="size-3.5 shrink-0 text-subtle" />
    </>
  );
}

function CreateRow({ item, busy }: { item: MentionItem; busy: boolean }) {
  const meta = CATEGORY_META[item.category!];
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1 truncate">
        New {meta.singular.toLowerCase()} <span className="text-press">{item.name}</span>
      </span>
      <meta.icon className={cn("size-3.5 shrink-0", meta.text)} />
    </>
  );
}
