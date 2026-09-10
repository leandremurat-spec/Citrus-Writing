"use client";

import * as React from "react";
import { Link2 } from "lucide-react";

import { splitAliases, type CodexEntryCard } from "@/lib/codex/types";
import { findUnlinked, namePattern } from "@/lib/codex/unlinked";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useLiveDoc } from "@/components/workspace/live-chapter";

/** The event the editor listens for. A DOM event because the two live in different route slots. */
export const LINK_MENTIONS_EVENT = "pith:link-mentions";

export interface LinkMentionsDetail {
  chapterId: string;
  entryId: string;
  names: string[];
  label: string;
}

/**
 * "3 unlinked mentions", for the chapter that is open.
 *
 * Scanned from the live document rather than from the database, so it notices the name the
 * moment it is written and disappears the moment it is linked. Read-only until Link is
 * pressed: the manuscript is never rewritten on a guess.
 */
export function UnlinkedMentions({ entry, chapterId }: { entry: CodexEntryCard; chapterId: string | null }) {
  const doc = useLiveDoc(chapterId);

  const hits = React.useMemo(() => {
    if (!doc) return [];
    return findUnlinked(doc, namePattern([entry.name, ...splitAliases(entry.aliases)]));
  }, [doc, entry.name, entry.aliases]);

  if (!chapterId || hits.length === 0) return null;

  const link = () => {
    window.dispatchEvent(
      new CustomEvent<LinkMentionsDetail>(LINK_MENTIONS_EVENT, {
        detail: {
          chapterId,
          entryId: entry.id,
          names: [entry.name, ...splitAliases(entry.aliases)],
          label: entry.name,
        },
      }),
    );
  };

  return (
    <div className="mt-2 rounded-md bg-ochre/8 p-2 ring-1 ring-ochre/25 ring-inset">
      <p className="flex items-center gap-1.5 text-2xs text-foreground">
        <Link2 className="size-3 shrink-0 text-ochre" aria-hidden />
        {pluralize(hits.length, "unlinked mention")} in this chapter
      </p>
      <p className="mt-1 font-serif text-2xs leading-relaxed text-subtle">“{hits[0].excerpt}”</p>
      <Button variant="outline" size="xs" className="mt-2" onClick={link}>
        Link {hits.length > 1 ? `all ${hits.length}` : "it"}
      </Button>
    </div>
  );
}
