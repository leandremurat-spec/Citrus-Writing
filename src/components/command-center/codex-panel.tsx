"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, MoreHorizontal, Pencil, Plus, Search, SquareArrowOutUpRight, Trash2 } from "lucide-react";

import { searchCodex } from "@/lib/codex/search";
import { CODEX_CATEGORIES, splitAliases, type ChapterMention, type CodexEntryCard } from "@/lib/codex/types";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CATEGORY_META, initials } from "@/components/codex/category-meta";
import { UnlinkedMentions } from "@/components/codex/unlinked-mentions";
import { useCodex } from "@/components/codex/codex-provider";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PanelFootnote } from "@/components/ui/panel-chrome";
import { useLiveMentions } from "@/components/workspace/live-chapter";

/**
 * The Codex tab: search, create, edit, and delete entries, with the ones mentioned in the
 * open chapter pulled to the top. Mention counts come from the editor while you type and fall
 * back to the saved index.
 */
export function CodexPanel({ mentions, chapterId }: { mentions: ChapterMention[]; chapterId: string | null }) {
  const router = useRouter();
  const params = useParams<{ novelId: string }>();
  const { entries, openCreate } = useCodex();
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const live = useLiveMentions(chapterId);
  const mentionCounts = React.useMemo(() => {
    if (live) return new Map(Object.entries(live));
    return new Map(mentions.map((mention) => [mention.codexEntryId, mention.mentionCount]));
  }, [live, mentions]);

  const visible = React.useMemo(() => searchCodex(entries, query), [entries, query]);
  const inChapter = visible
    .filter((entry) => mentionCounts.has(entry.id))
    .sort((a, b) => (mentionCounts.get(b.id) ?? 0) - (mentionCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const groups = CODEX_CATEGORIES.map((category) => ({
    category,
    items: visible.filter((entry) => entry.category === category),
  })).filter((group) => group.items.length > 0);

  const renderEntry = (entry: CodexEntryCard) => (
    <EntryRow
      key={entry.id}
      entry={entry}
      mentionCount={mentionCounts.get(entry.id) ?? 0}
      open={openId === entry.id}
      onToggle={() => setOpenId((current) => (current === entry.id ? null : entry.id))}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the codex…"
            aria-label="Search the codex"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="New codex entry"
          onClick={() => openCreate(query.trim() ? { name: query.trim() } : undefined)}
        >
          <Plus />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mx-2 mb-1 justify-start text-subtle"
        onClick={() => router.push(`/novels/${params.novelId}/codex`)}
      >
        <SquareArrowOutUpRight /> Open full Codex
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {entries.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Your codex is empty.</p>
            <p className="mt-1 text-xs text-subtle">
              Type <span className="text-press">@</span> while writing to create characters, places, and items
              without leaving the page.
            </p>
            <Button size="sm" className="mt-3" onClick={() => openCreate()}>
              <Plus /> New entry
            </Button>
          </div>
        ) : (
          <>
            {inChapter.length > 0 && <Section title="In this chapter">{inChapter.map(renderEntry)}</Section>}
            {groups.map((group) => (
              <Section key={group.category} title={CATEGORY_META[group.category].plural}>
                {group.items.map(renderEntry)}
              </Section>
            ))}
            {visible.length === 0 && (
              <div className="px-2 py-6 text-center">
                <p className="text-xs text-muted-foreground">No entries match “{query}”.</p>
                <Button variant="outline" size="sm" className="mt-2.5" onClick={() => openCreate({ name: query.trim() })}>
                  <Plus /> Create “{query.trim()}”
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <PanelFootnote>
        Type <span className="text-press">@</span> in the editor to link or create an entry.
      </PanelFootnote>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="label-section px-2 pt-2 pb-1">
        {title}
      </h3>
      <div className="flex flex-col gap-px">{children}</div>
    </section>
  );
}

function EntryRow({
  entry,
  mentionCount,
  open,
  onToggle,
}: {
  entry: CodexEntryCard;
  mentionCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ novelId: string; chapterId?: string }>();
  const { openEdit, confirmDelete } = useCodex();
  const meta = CATEGORY_META[entry.category];
  const aliases = splitAliases(entry.aliases);

  return (
    // Base UI supplies aria-expanded and the aria-controls/id pair the hand-rolled
    // version never had, and unmounts the panel when closed so a long codex does not
    // render every entry's detail.
    <Collapsible
      open={open}
      onOpenChange={onToggle}
      render={<div className={cn("group/entry rounded-md", open && "bg-muted/40")} />}
    >
      <div className="flex items-center gap-1">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="focus-ring-inset flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-tint ease-state hover:bg-muted/60"
            />
          }
        >
          {entry.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied URLs, unoptimised on purpose
            <img src={entry.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
                meta.tint,
              )}
            >
              {initials(entry.name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{entry.name}</span>
            {entry.summary && <span className="block truncate text-xs text-muted-foreground">{entry.summary}</span>}
          </span>
          {mentionCount > 0 && (
            <span className="shrink-0 rounded-full bg-press/15 px-1.5 text-3xs font-medium text-press tabular-nums">
              ×{mentionCount}
            </span>
          )}
          <ChevronRight
            className={cn("size-3.5 shrink-0 text-subtle transition-transform duration-state ease-state", open && "rotate-90")}
          />
        </CollapsibleTrigger>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${entry.name}`}
                className="mr-1 shrink-0 opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => openEdit(entry.id)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => confirmDelete(entry.id)}>
              <Trash2 /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CollapsibleContent className="px-2 pt-0.5 pb-2.5 pl-[2.9rem] text-xs leading-relaxed text-muted-foreground">
          {entry.description ? (
            <p className="font-serif whitespace-pre-line">{entry.description}</p>
          ) : (
            <p className="italic">No lore written yet.</p>
          )}

          <p className="mt-1.5 flex flex-wrap items-center gap-1 text-2xs text-subtle">
            <meta.icon className="size-3" />
            {meta.singular}
            {aliases.length > 0 && <> · also “{aliases.join("”, “")}”</>}
          </p>

          {entry.mentionedIn.length > 0 && (
            <div className="mt-2">
              <p className="text-2xs font-medium text-subtle">
                Mentioned in {pluralize(entry.chapterCount, "chapter")}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {entry.mentionedIn.map((link) => (
                  <li key={link.chapterId}>
                    <button
                      type="button"
                      onClick={() => router.push(`/novels/${params.novelId}/chapters/${link.chapterId}`)}
                      className={cn(
                        "focus-ring-inset flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-2xs transition-colors duration-tint ease-state hover:bg-muted/60 hover:text-foreground",
                        link.chapterId === params.chapterId && "text-press",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{link.title}</span>
                      <span className="shrink-0 tabular-nums opacity-70">×{link.mentionCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <UnlinkedMentions entry={entry} chapterId={params.chapterId ?? null} />

          <Button variant="outline" size="xs" className="mt-2.5" onClick={() => openEdit(entry.id)}>
            <Pencil /> Edit entry
          </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
