"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { differenceInCalendarDays, format, isToday, isTomorrow } from "date-fns";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";

import { createChapter } from "@/lib/actions/binder";
import { STATUS_META } from "@/lib/binder/status";
import { ROOT, findNode, flattenTree, type BinderNode, type ContainerRef, type FlatNode } from "@/lib/binder/tree";
import type { BufferSummary } from "@/lib/data/schedule";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { useLiveCount } from "./live-chapter";

/** "next out Saturday" / "next out 12 Oct" / "nothing queued yet". */
function nextOutLabel(date: Date | null): string {
  if (!date) return "nothing queued yet";
  if (isToday(date)) return "next out today";
  if (isTomorrow(date)) return "next out tomorrow";
  return `next out ${differenceInCalendarDays(date, new Date()) < 7 ? format(date, "EEEE") : format(date, "d MMM")}`;
}

/** Fixed width of one chapter's column, wide enough for a two-digit run number. */
const SLOT = 30;

/**
 * A chapter's dot size grows with its word count, capped at the sweet spot — a seed getting
 * bigger as the chapter fills in, the same metaphor the Binder's own "drag a seed to reorder"
 * copy already uses.
 */
function dotSize(wordCount: number, sweetSpotMax: number): number {
  const t = Math.min(1, wordCount / Math.max(1, sweetSpotMax));
  return 7 + t * 13;
}

/** The nearest ancestor arc's title, or null if the chapter sits directly in a volume or the root. */
function enclosingArcTitle(nodes: readonly BinderNode[], chapter: BinderNode): string | null {
  let container = chapter.parent;
  while (container.kind !== "root") {
    const node = findNode(nodes, container.id);
    if (!node) break;
    if (node.type === "arc") return node.title;
    container = node.parent;
  }
  return null;
}

/**
 * Where a chapter sits in the hierarchy: its arc, and the volume that arc is in.
 *
 * Both are walked independently rather than taking "the nearest container", because the run
 * band shows them as two tiers and a chapter can have either, both, or neither — an interlude
 * sitting straight in a volume has no arc, and a prologue at the novel root has neither.
 */
function chapterPlacement(
  nodes: readonly BinderNode[],
  chapter: BinderNode,
): { volumeKey: string; volumeTitle: string | null; arcKey: string; arcTitle: string | null } {
  let volumeKey = "root";
  let volumeTitle: string | null = null;
  let arcKey = "loose";
  let arcTitle: string | null = null;

  let container = chapter.parent;
  while (container.kind !== "root") {
    const node = findNode(nodes, container.id);
    if (!node) break;
    if (node.type === "arc" && arcTitle === null) {
      arcKey = node.id;
      arcTitle = node.title;
    } else if (node.type === "volume") {
      volumeKey = node.id;
      volumeTitle = node.title;
    }
    container = node.parent;
  }
  return { volumeKey, volumeTitle, arcKey, arcTitle };
}

/**
 * The Run: the whole novel's chapters as one strand, in document order. It replaces nothing —
 * the Binder underneath still owns the tree — but it is the one place a writer can see the
 * shape of the serial at a glance: what is out, what is next, and how big each chapter has
 * grown. Dots left of the dashed line are the last thing readers have seen; nothing here
 * changes what happens when you click one, it just opens that chapter.
 */
export function RunBand({
  novelId,
  novelTitle,
  nodes,
  sweetSpotMax,
  bufferSummary,
}: {
  novelId: string;
  novelTitle: string;
  nodes: BinderNode[];
  sweetSpotMax: number;
  /**
   * Absent for a writer whose plan has no Buffer.
   *
   * Passing the summary and hiding the pill would still have computed it, and — worse — would
   * have left a link to a route that redirects to the pricing page. The caller simply does not
   * pass it, which is the same shape the Progress panel already used.
   */
  bufferSummary?: BufferSummary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ chapterId?: string }>();
  const activeChapterId = params.chapterId ?? null;

  const chapters = React.useMemo(
    () => flattenTree(nodes).filter((node): node is FlatNode & { type: "chapter" } => node.type === "chapter"),
    [nodes],
  );

  const activeChapter = activeChapterId ? findNode(nodes, activeChapterId) : undefined;
  const arcTitle = activeChapter ? enclosingArcTitle(nodes, activeChapter) : null;

  const publishedCount = React.useMemo(() => chapters.filter((c) => c.status === "PUBLISHED").length, [chapters]);
  const lastPublishedIndex = React.useMemo(() => {
    let index = -1;
    chapters.forEach((c, i) => {
      if (c.status === "PUBLISHED") index = i;
    });
    return index;
  }, [chapters]);
  const dashedAt = lastPublishedIndex >= 0 && lastPublishedIndex < chapters.length - 1 ? lastPublishedIndex + 1 : -1;

  // Where a new chapter goes: next to the chapter being read, else the last arc, else the root.
  const chapterParent: ContainerRef = React.useMemo(() => {
    if (activeChapter) return activeChapter.parent;
    const lastArc = flattenTree(nodes)
      .reverse()
      .find((item) => item.type === "arc");
    return lastArc ? { kind: "arc", id: lastArc.id } : ROOT;
  }, [nodes, activeChapter]);

  /**
   * The run, cut into volumes and then into arcs. Two tiers, because one was not enough: a flat
   * row of group labels says "Arc 1, then Volume 1, then Arc 2" without ever saying that the
   * arcs are *inside* the volume. Chapters keep their global run number across every break — a
   * chapter's number is its position in the serial, not in its arc.
   */
  const tiers = React.useMemo(() => {
    type Arc = { key: string; title: string | null; chapters: { chapter: FlatNode; index: number }[] };
    const result: { key: string; title: string | null; arcs: Arc[] }[] = [];
    chapters.forEach((chapter, index) => {
      const at = chapterPlacement(nodes, chapter);
      let volume = result[result.length - 1];
      if (!volume || volume.key !== at.volumeKey) {
        volume = { key: at.volumeKey, title: at.volumeTitle, arcs: [] };
        result.push(volume);
      }
      let arc = volume.arcs[volume.arcs.length - 1];
      if (!arc || arc.key !== at.arcKey) {
        arc = { key: at.arcKey, title: at.arcTitle, chapters: [] };
        volume.arcs.push(arc);
      }
      arc.chapters.push({ chapter, index });
    });
    return result;
  }, [nodes, chapters]);

  // Keep the open chapter in view. Without this a scrolling strand starts at chapter one every
  // time, which for a writer forty chapters in means the run never shows where they are.
  // `block: "nearest"` so it never scrolls the page itself, only the strand.
  const activeRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeChapterId]);

  const handleAddChapter = async () => {
    const response = await createChapter({ novelId, parent: chapterParent });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    router.push(`/novels/${novelId}/chapters/${response.id}`);
  };

  // The Buffer replaces the run band entirely with its own calendar (see BufferBoard) — the
  // same reasoning as WorkspaceShell dropping the Command Centre column for it and for Codex.
  if (chapters.length === 0 || pathname?.endsWith("/buffer")) return null;

  return (
    <div aria-label="The run" className="flex h-[96px] shrink-0 items-center gap-7 bg-background px-5">
      {/*
        The strand scrolls. It used to be an auto-width flex row, so a serial of any real length
        simply grew past the header and took the arc title and the buffer pill off the screen
        with it — at 30px a chapter, forty of them is already wider than the window. Now the
        card is the flex child that gives, and the run scrolls inside it.
      */}
      <div className="min-w-0 flex-1 overflow-x-auto rounded-[28px] bg-card shadow-e0 [scrollbar-width:thin]">
        <div className="flex w-max items-start gap-5 px-4 py-2">
          {tiers.map((volume) => (
            <div key={volume.key} className="flex shrink-0 flex-col gap-1">
              {/*
                The volume tier. It spans its arcs and is drawn as a bracket rather than a label
                on its own, so it reads as "everything under here" — the one thing a single row
                of group labels could never say.
              */}
              {volume.title ? (
                <div className="flex flex-col gap-0.5">
                  <span className="max-w-full truncate px-1 text-3xs leading-3 font-semibold tracking-wide text-press uppercase">
                    {volume.title}
                  </span>
                  <span aria-hidden className="h-px w-full rounded-full bg-press/35" />
                </div>
              ) : (
                <span aria-hidden className="h-[15px]" />
              )}

              <div className="flex items-start gap-3">
                {volume.arcs.map((arc) => (
                  <div key={arc.key} className="flex shrink-0 flex-col gap-0.5">
                    <span className="h-4 max-w-40 truncate px-1 text-3xs leading-4 font-medium text-subtle">
                      {arc.title ?? "No arc"}
                    </span>

                    <div className="relative flex items-start">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute top-[23px] right-1 left-1 h-0.5 rounded-full bg-ochre-300"
                      />

                      {arc.chapters.map(({ chapter, index }) => (
                        <React.Fragment key={chapter.id}>
                          {index === dashedAt && (
                            <span
                              aria-hidden
                              className="relative z-10 mx-1 mt-4 h-[26px] w-0 self-start border-l-2 border-dashed border-ochre-600"
                            />
                          )}
                          <div
                            ref={chapter.id === activeChapterId ? activeRef : undefined}
                            className="relative z-10 flex shrink-0 flex-col items-center"
                            style={{ width: SLOT }}
                          >
                            <span
                              className={cn(
                                "h-4 text-3xs leading-4 tabular-nums",
                                chapter.id === activeChapterId ? "font-bold text-press" : "text-subtle",
                              )}
                            >
                              {index + 1}
                            </span>
                            <RunDot
                              chapter={chapter}
                              isCurrent={chapter.id === activeChapterId}
                              sweetSpotMax={sweetSpotMax}
                              onOpen={() => router.push(`/novels/${novelId}/chapters/${chapter.id}`)}
                            />
                            {/*
                              Where the writer is, in the same vocabulary as the dashed reader
                              line but solid and in the brand colour: readers are behind the
                              dashes, you are on the caret. The ring around the dot says the same
                              thing, but only once you have found it — this is visible while
                              scanning the whole strand.
                            */}
                            {chapter.id === activeChapterId && (
                              <span
                                aria-hidden
                                className="absolute -bottom-1 size-0 border-x-4 border-b-4 border-x-transparent border-b-press"
                              />
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex shrink-0 flex-col gap-1 self-end">
            <div className="flex h-[26px] items-center">
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full bg-muted text-subtle"
                aria-label="Add a chapter to the run"
                onClick={() => void handleAddChapter()}
              >
                <Plus />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-44 shrink-0 flex-col gap-0.5">
        <span className="truncate font-heading text-sm">{arcTitle ?? novelTitle}</span>
        <span className="truncate text-2xs text-subtle">
          {publishedCount} of {chapters.length} published
        </span>
      </div>

      {bufferSummary && (
        <Link
          href={`/novels/${novelId}/buffer`}
          className="focus-ring flex shrink-0 items-center gap-2.5 rounded-full bg-ochre-100 px-4 py-2 whitespace-nowrap"
        >
          <CalendarClock className="size-4 text-ochre-700" aria-hidden />
          <span className="text-xs text-ochre-800">
            {bufferSummary.runwayWeeks > 0 ? (
              <>
                <strong>
                  {Math.round(bufferSummary.runwayWeeks * 10) / 10} {bufferSummary.runwayWeeks === 1 ? "week" : "weeks"}
                </strong>{" "}
                of buffer · {nextOutLabel(bufferSummary.nextOutDate)}
              </>
            ) : (
              nextOutLabel(bufferSummary.nextOutDate)
            )}
          </span>
        </Link>
      )}
    </div>
  );
}

function RunDot({
  chapter,
  isCurrent,
  sweetSpotMax,
  onOpen,
}: {
  chapter: FlatNode;
  isCurrent: boolean;
  sweetSpotMax: number;
  onOpen: () => void;
}) {
  const liveWordCount = useLiveCount(chapter.id, chapter.wordCount ?? 0);
  const status = chapter.status ?? "DRAFT";
  const size = Math.round(dotSize(liveWordCount, sweetSpotMax));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={isCurrent ? "page" : undefined}
      aria-label={`${chapter.title} — ${STATUS_META[status].label}, ${formatCompact(liveWordCount)} words`}
      className={cn(
        "focus-ring flex size-[26px] shrink-0 items-center justify-center rounded-full",
        isCurrent && "shadow-[inset_0_0_0_2px_var(--press)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block rounded-full",
          status === "DRAFT" && "border-[1.5px] border-neutral-600 bg-transparent",
          status === "EDITED" && "bg-ochre-400",
          status === "QUEUED" && "animate-run-breathe bg-press-200 ring-2 ring-press",
          status === "PUBLISHED" && "bg-press",
        )}
        style={{ width: size, height: size }}
      />
    </button>
  );
}
