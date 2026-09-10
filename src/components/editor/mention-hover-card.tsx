"use client";

import * as React from "react";
import { Pencil } from "lucide-react";

import { splitAliases, type CodexEntryCard } from "@/lib/codex/types";
import { placeFloating } from "@/lib/editor/floating";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CATEGORY_META, initials } from "@/components/codex/category-meta";
import { useCodex } from "@/components/codex/codex-provider";
import { Surface } from "@/components/ui/surface";

/** Grace period so the pointer can travel from the mention to the card. */
const CLOSE_DELAY_MS = 120;
const OPEN_DELAY_MS = 220;

interface HoverState {
  entry: CodexEntryCard;
  anchor: DOMRect;
}

/**
 * Shows a codex card when the pointer rests on an @mention in the manuscript. It listens on
 * the editor's DOM rather than wrapping mentions in node views, so the document schema stays
 * plain (which keeps Step 5's export simple) and the caret is never disturbed.
 */
export function MentionHoverCard({ editorRoot }: { editorRoot: HTMLElement | null }) {
  const { byId, openEdit } = useCodex();
  const [state, setState] = React.useState<HoverState | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<{ open?: number; close?: number }>({});

  const clearTimers = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
  };

  React.useEffect(() => {
    if (!editorRoot) return;

    const scheduleClose = () => {
      window.clearTimeout(timers.current.open);
      window.clearTimeout(timers.current.close);
      timers.current.close = window.setTimeout(() => setState(null), CLOSE_DELAY_MS);
    };

    const onOver = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-type="mention"]');
      if (!target) return;
      const id = target.getAttribute("data-id");
      const entry = id ? byId.get(id) : undefined;
      // Mentions of deleted entries stay in the text; they simply have nothing to show.
      if (!entry) return;
      window.clearTimeout(timers.current.close);
      window.clearTimeout(timers.current.open);
      timers.current.open = window.setTimeout(() => {
        // A wrapped mention spans several line boxes; anchor to the one under the pointer.
        const rects = [...target.getClientRects()];
        const anchor = rects.find((rect) => event.clientY >= rect.top && event.clientY <= rect.bottom) ?? rects[0];
        setState({ entry, anchor: anchor ?? target.getBoundingClientRect() });
      }, OPEN_DELAY_MS);
    };

    const onOut = (event: MouseEvent) => {
      const from = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-type="mention"]');
      if (!from) return;
      const to = event.relatedTarget as Node | null;
      if (to && (from.contains(to) || cardRef.current?.contains(to))) return;
      scheduleClose();
    };

    // `mouseover`/`mouseout` rather than the pointer equivalents: they bubble the same way
    // and fire in every browser and automation harness that reports a hover at all.
    editorRoot.addEventListener("mouseover", onOver);
    editorRoot.addEventListener("mouseout", onOut);
    window.addEventListener("scroll", scheduleClose, true);
    return () => {
      editorRoot.removeEventListener("mouseover", onOver);
      editorRoot.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", scheduleClose, true);
      clearTimers();
    };
  }, [editorRoot, byId]);

  // Position after the card has real dimensions.
  React.useLayoutEffect(() => {
    if (state && cardRef.current) placeFloating(cardRef.current, state.anchor, { offset: 8, preferAbove: true });
  }, [state]);

  if (!state) return null;
  const { entry } = state;
  const meta = CATEGORY_META[entry.category];
  const aliases = splitAliases(entry.aliases);

  return (
    <Surface
      ref={cardRef}
      level="floating"
      tone="popover"
      // Not role="tooltip": a tooltip is a plain string, and this holds an Edit button.
      // A non-modal dialog is what a hover card that contains a control actually is.
      role="dialog"
      aria-label={`${entry.name} — codex entry`}
      className="fixed z-50 w-72 p-3 text-popover-foreground duration-state ease-out-quiet animate-in fade-in zoom-in-95"
      onMouseEnter={clearTimers}
      onMouseLeave={() => setState(null)}
    >
      <div className="flex items-start gap-2.5">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- author-supplied URLs, unoptimised on purpose
          <img src={entry.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", meta.tint)}>
            {initials(entry.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{entry.name}</p>
          <p className={cn("flex items-center gap-1 text-2xs", meta.text)}>
            <meta.icon className="size-3" />
            {meta.singular}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Edit ${entry.name}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setState(null);
            openEdit(entry.id);
          }}
          className="focus-ring shrink-0 rounded p-1 text-muted-foreground transition-colors duration-tint ease-state hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {entry.summary && <p className="mt-2 text-xs text-muted-foreground">{entry.summary}</p>}
      {entry.description && (
        <p className="mt-2 line-clamp-5 font-serif text-xs leading-relaxed text-foreground/80">{entry.description}</p>
      )}
      {!entry.summary && !entry.description && (
        <p className="mt-2 text-xs text-muted-foreground italic">No lore written yet.</p>
      )}

      <p className="mt-2.5 border-t border-divider pt-2 text-2xs text-subtle">
        Mentioned in {pluralize(entry.chapterCount, "chapter")}
        {aliases.length > 0 && <> · also “{aliases.join("”, “")}”</>}
      </p>
    </Surface>
  );
}
