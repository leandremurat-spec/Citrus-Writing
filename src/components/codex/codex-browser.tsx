"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { deleteCodexTie } from "@/lib/actions/codex-ties";
import { searchCodex } from "@/lib/codex/search";
import { CODEX_CATEGORIES, CODEX_CATEGORY_LABEL, splitAliases, type CodexCategory, type CodexEntryCard } from "@/lib/codex/types";
import type { CodexEntryDetail, CodexTieRow, MentionThread as MentionThreadData, UnlinkedSummaryChapter } from "@/lib/data/codex";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCodex } from "@/components/codex/codex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { CATEGORY_META } from "./category-meta";
import { EntryAvatar } from "./entry-avatar";
import { MentionThread } from "./mention-thread";
import { TieFormDialog, type TieCandidate } from "./tie-form-dialog";
import { UnlinkedSummary } from "./unlinked-summary";

export interface CodexBrowserDetail {
  entry: CodexEntryDetail;
  ties: CodexTieRow[];
  mentionThread: MentionThreadData;
  unlinkedSummary: UnlinkedSummaryChapter[];
  otherEntries: TieCandidate[];
}

type CategoryFilter = "ALL" | CodexCategory;

/**
 * The full-page Codex: the entries list beside the entry it opens to, replacing the Command
 * Centre column entirely (see `WorkspaceShell` and `@panel/codex/[[...rest]]`). The entries
 * list itself comes from `useCodex()` — the same provider the @ popover and the old
 * in-chapter Codex tab already share — so creating or editing an entry here is visible
 * everywhere else at once, with no separate state to keep in sync.
 */
export function CodexBrowser({
  novelId,
  selectedEntryId,
  detail,
}: {
  novelId: string;
  selectedEntryId: string | null;
  detail: CodexBrowserDetail | null;
}) {
  const { entries, openCreate } = useCodex();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryFilter>("ALL");

  const visible = React.useMemo(() => {
    const matches = searchCodex(entries, query);
    return category === "ALL" ? matches : matches.filter((entry) => entry.category === category);
  }, [entries, query, category]);

  const groups = CODEX_CATEGORIES.map((cat) => ({
    category: cat,
    items: visible.filter((entry) => entry.category === cat),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full min-h-0">
      <section aria-label="Codex entries" className="flex w-[292px] shrink-0 flex-col border-r border-divider">
        <div className="flex shrink-0 flex-col gap-2.5 p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="font-heading text-xl">Codex</h1>
            <span className="text-2xs whitespace-nowrap text-subtle">{pluralize(entries.length, "entry", "entries")}</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the codex…"
                aria-label="Search the codex"
                className="h-[34px] pl-8 text-sm"
              />
            </div>
            <Button
              size="icon-sm"
              aria-label="New entry"
              onClick={() => openCreate(query.trim() ? { name: query.trim() } : undefined)}
            >
              <Plus />
            </Button>
          </div>
          <CategorySegments value={category} onChange={setCategory} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3.5">
          {entries.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">Your codex is empty.</p>
              <Button size="sm" className="mt-3" onClick={() => openCreate()}>
                <Plus /> New entry
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">No entries match.</p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.category} className="mb-3">
                <h3 className="label-section px-2 pt-2 pb-1">{CATEGORY_META[group.category].plural}</h3>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((entry) => (
                    <EntryListRow
                      key={entry.id}
                      novelId={novelId}
                      entry={entry}
                      active={entry.id === selectedEntryId}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {detail ? (
          <EntryDetail novelId={novelId} detail={detail} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">Choose an entry.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function CategorySegments({ value, onChange }: { value: CategoryFilter; onChange: (value: CategoryFilter) => void }) {
  const options: { value: CategoryFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    ...CODEX_CATEGORIES.map((category) => ({ value: category, label: CODEX_CATEGORY_LABEL[category].plural })),
  ];
  return (
    <div className="flex gap-0.5 rounded-full bg-muted/60 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring-inset flex-1 rounded-full px-2 py-1.5 text-2xs font-medium transition-colors duration-tint ease-state",
              active ? "bg-press text-press-foreground" : "text-subtle hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function EntryListRow({ novelId, entry, active }: { novelId: string; entry: CodexEntryCard; active: boolean }) {
  return (
    <Link
      href={`/novels/${novelId}/codex/${entry.id}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "focus-ring-inset flex items-center gap-2.5 rounded-full px-2 py-1.5 transition-colors duration-tint ease-state",
        active ? "bg-press-200 shadow-e0" : "hover:bg-muted/60",
      )}
    >
      <EntryAvatar
        name={entry.name}
        category={entry.category}
        avatarUrl={entry.avatarUrl}
        className={cn("size-8 text-2xs", active && "bg-press text-press-foreground")}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", active && "font-medium text-press-900")}>{entry.name}</span>
        {entry.summary && (
          <span className={cn("block truncate text-2xs", active ? "text-press-800" : "text-muted-foreground")}>
            {entry.summary}
          </span>
        )}
      </span>
      {entry.chapterCount > 0 && (
        <span className={cn("shrink-0 text-2xs tabular-nums", active ? "text-press-800" : "text-subtle")}>
          ×{entry.chapterCount}
        </span>
      )}
    </Link>
  );
}

function EntryDetail({ novelId, detail }: { novelId: string; detail: CodexBrowserDetail }) {
  const { entry, ties, mentionThread, unlinkedSummary, otherEntries } = detail;
  const { openEdit } = useCodex();
  const router = useRouter();
  const [tieDialogOpen, setTieDialogOpen] = React.useState(false);
  const aliases = splitAliases(entry.aliases);
  const meta = CATEGORY_META[entry.category];

  const removeTie = async (id: string) => {
    const response = await deleteCodexTie({ id });
    if (!response.ok) toast.error(response.error);
  };

  return (
    <div className="mx-auto max-w-[48rem] px-10 py-8">
      <div className="flex items-start gap-4.5">
        <EntryAvatar
          name={entry.name}
          category={entry.category}
          avatarUrl={entry.avatarUrl}
          className="size-[76px] font-heading text-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="label-eyebrow mb-1.5 flex items-center gap-1.5">
            <meta.icon className="size-3.5" />
            {meta.singular}
          </p>
          <h1 className="font-heading text-3xl">{entry.name}</h1>
          {aliases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {aliases.map((alias) => (
                <span key={alias} className="rounded-full bg-muted px-2.5 py-0.5 text-2xs text-muted-foreground">
                  also “{alias}”
                </span>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => openEdit(entry.id)}>
          Edit
        </Button>
      </div>

      {entry.summary && <p className="mt-5 font-serif text-lg leading-relaxed text-foreground/90">{entry.summary}</p>}
      {entry.description && (
        <p className="mt-3 font-serif text-base leading-relaxed whitespace-pre-line text-foreground/80">
          {entry.description}
        </p>
      )}

      {entry.sheetFields.length > 0 && (
        <>
          <h2 className="mt-9 mb-3 font-heading text-xl">Character sheet</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {entry.sheetFields.map((field, index) => (
              <div key={index} className="rounded-[1.375rem] bg-card px-4.5 py-4">
                <p className="label-section">{field.label}</p>
                <p className="mt-1 text-sm leading-relaxed">{field.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-9 mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl">Ties</h2>
        <Button variant="outline" size="sm" onClick={() => setTieDialogOpen(true)}>
          <Link2 /> Add a tie
        </Button>
      </div>
      {ties.length === 0 ? (
        <p className="text-sm text-subtle">No ties yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ties.map((tie) => (
            <div key={tie.id} className="group/tie flex items-center gap-3.5 rounded-[1.625rem] bg-card py-3 pr-3 pl-2.5">
              <EntryAvatar name={tie.target.name} category={tie.target.category} avatarUrl={tie.target.avatarUrl} className="size-9 text-xs" />
              <span aria-hidden className="h-0.5 w-6 shrink-0 rounded-full border-t-2 border-dashed border-ochre-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{tie.target.name}</span>
                <span className="block text-2xs text-muted-foreground">{tie.description}</span>
              </span>
              <span className="shrink-0 rounded-full bg-ochre-100 px-2.5 py-0.5 text-2xs text-ochre-800">{tie.label}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove the tie to ${tie.target.name}`}
                className="shrink-0 opacity-0 group-hover/tie:opacity-100"
                onClick={() => void removeTie(tie.id)}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-9 mb-3 font-heading text-xl">Where it appears</h2>
      <MentionThread chapters={mentionThread.chapters} totalMentions={mentionThread.totalMentions} />

      {unlinkedSummary.length > 0 && (
        <div className="mt-4">
          <UnlinkedSummary
            entryName={entry.name}
            summary={unlinkedSummary}
            onOpenChapter={(chapterId) => router.push(`/novels/${novelId}/chapters/${chapterId}`)}
          />
        </div>
      )}

      <TieFormDialog
        open={tieDialogOpen}
        onOpenChange={setTieDialogOpen}
        novelId={novelId}
        fromEntryId={entry.id}
        fromEntryName={entry.name}
        candidates={otherEntries}
        onCreated={() => {}}
      />
    </div>
  );
}
