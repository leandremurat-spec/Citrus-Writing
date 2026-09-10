"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BookOpen, FileText, ListChecks, ListFilter, Milestone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createArc, createChapter, createVolume, deleteNode, moveNode, renameNode } from "@/lib/actions/binder";
import { deleteChapters, setChaptersStatus } from "@/lib/actions/chapters";
import type { ActionResult } from "@/lib/actions/result";
import { setChapterStatus } from "@/lib/actions/chapters";
import { CHAPTER_STATUSES, STATUS_META } from "@/lib/binder/status";
import { pluralize } from "@/lib/format";
import {
  NODE_TYPE_LABEL,
  ROOT,
  applyMove,
  asContainer,
  childrenOf,
  containerKey,
  descendantChapters,
  findNode,
  flattenTree,
  getProjection,
  sameContainer,
  suggestTitle,
  type BinderNode,
  type ChapterStatus,
  type ContainerRef,
  type FlatNode,
  type NodeType,
} from "@/lib/binder/tree";
import { useLocalStorageValue } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PanelChrome, PanelFootnote } from "@/components/ui/panel-chrome";

import { ConfirmDialog, DeleteDialog, TitleDialog } from "./binder-dialogs";
import { StatusDot } from "./status-badge";
import { BinderRow, BinderRowGhost, type RowAction } from "./binder-row";

/** Horizontal pixels per nesting level; also the drag distance that changes depth. */
const INDENT = 18;

type DialogState =
  | { mode: "rename"; node: BinderNode }
  | { mode: "create"; type: Exclude<NodeType, "chapter">; parent: ContainerRef }
  | { mode: "delete"; node: BinderNode }
  | null;

function parseKeys(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function countDescendants(nodes: readonly BinderNode[], node: BinderNode): number {
  const own = asContainer(node);
  if (!own) return 0;
  return childrenOf(nodes, own).reduce((sum, child) => sum + 1 + countDescendants(nodes, child), 0);
}

/** The volume an item ultimately sits in, if any. */
function enclosingVolume(nodes: readonly BinderNode[], container: ContainerRef): ContainerRef {
  let current = container;
  while (current.kind !== "root") {
    if (current.kind === "volume") return current;
    const node = findNode(nodes, current.id);
    if (!node) break;
    current = node.parent;
  }
  return ROOT;
}

/** One shared empty array, so a chapter's absent subtree is always the same reference. */
const NO_CHAPTERS: readonly { id: string; wordCount: number }[] = [];

export function Binder({ novelId, nodes: serverNodes }: { novelId: string; nodes: BinderNode[] }) {
  const router = useRouter();
  const params = useParams<{ chapterId?: string }>();
  const activeChapterId = params.chapterId ?? null;

  // Optimistic local copy of the tree. Whenever the server sends fresh nodes (after any
  // mutation revalidates the layout) the local copy is replaced during render.
  const [nodes, setNodes] = React.useState(serverNodes);
  const [syncedNodes, setSyncedNodes] = React.useState(serverNodes);
  if (syncedNodes !== serverNodes) {
    setSyncedNodes(serverNodes);
    setNodes(serverNodes);
  }

  // Collapsed containers persist per novel in localStorage.
  const [collapsedRaw, setCollapsedRaw] = useLocalStorageValue(`pith:binder:collapsed:${novelId}`);
  const collapsed = React.useMemo(() => new Set(parseKeys(collapsedRaw)), [collapsedRaw]);
  const saveCollapsed = (next: Set<string>) => setCollapsedRaw(next.size ? JSON.stringify([...next]) : null);
  const toggleCollapsed = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    saveCollapsed(next);
  };
  const expand = (container: ContainerRef) => {
    const key = containerKey(container);
    if (!collapsed.has(key)) return;
    const next = new Set(collapsed);
    next.delete(key);
    saveCollapsed(next);
  };

  // Drag state.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = React.useState(0);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkPending, startBulk] = React.useTransition();

  /*
   * Status filter. A long serial is read by state as often as by order — "what is still
   * drafted", "what is queued to go out" — and the binder had no way to ask.
   *
   * Filtering only ever hides *chapters*. A volume or arc whose chapters have all been
   * filtered away still shows, because a container disappearing out from under its own
   * heading reads as data loss rather than as a filter. Dragging is disabled while a filter
   * is on: reordering against a partial list would move rows past siblings you cannot see.
   */
  const [statusFilter, setStatusFilter] = React.useState<ChapterStatus | null>(null);
  const filtering = statusFilter !== null;

  const flat = React.useMemo(() => {
    const rows = flattenTree(nodes, { collapsed, hideChildrenOf: activeId });
    if (!statusFilter) return rows;
    return rows.filter((item) => item.type !== "chapter" || item.status === statusFilter);
  }, [nodes, collapsed, activeId, statusFilter]);

  /*
   * Position in the run.
   *
   * A serial author thinks in chapter numbers constantly — it is how readers refer to the
   * work, how the backlog is counted, and how a buffer is measured — but the number lives
   * nowhere in the data, only in whatever the author typed into the title. So it is derived
   * here from document order and shown as its own column: the one thing in this interface
   * set large enough to scan down.
   *
   * Derived, never stored: renumbering on a reorder is the correct behaviour, and persisting
   * it would make the number a second source of truth that could disagree with the order.
   */
  const runNumbers = React.useMemo(() => {
    const numbers = new Map<string, number>();
    let n = 0;
    for (const node of flattenTree(nodes)) {
      if (node.type === "chapter") numbers.set(node.id, ++n);
    }
    return numbers;
  }, [nodes]);

  const matchCount = React.useMemo(
    () => (statusFilter ? nodes.filter((node) => node.type === "chapter" && node.status === statusFilter).length : 0),
    [nodes, statusFilter],
  );
  const ids = React.useMemo(() => flat.map((item) => item.id), [flat]);
  const projection = activeId && overId ? getProjection(flat, activeId, overId, offsetLeft, INDENT) : null;
  const activeItem = activeId ? (flat.find((item) => item.id === activeId) ?? null) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
    setOffsetLeft(0);
  };
  const handleDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x);
  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);

  const handleDragEnd = async ({ active, over, delta }: DragEndEvent) => {
    const draggedId = String(active.id);
    const target = over ? getProjection(flat, draggedId, String(over.id), delta.x, INDENT) : null;
    resetDrag();
    if (!target) return;

    const node = findNode(nodes, draggedId);
    if (!node) return;
    const currentIndex = childrenOf(nodes, node.parent).findIndex((sibling) => sibling.id === draggedId);
    if (sameContainer(node.parent, target.parent) && currentIndex === target.index) return;

    let next: BinderNode[];
    try {
      next = applyMove(nodes, draggedId, target.parent, target.index).nodes;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That move is not allowed.");
      return;
    }

    const previous = nodes;
    setNodes(next);
    expand(target.parent);
    const response = await moveNode({ novelId, nodeId: draggedId, target: target.parent, index: target.index });
    if (!response.ok) {
      setNodes(previous);
      toast.error(response.error);
    }
  };

  // Where "New chapter" goes: next to the chapter being edited, else the last arc, else the root.
  const activeChapter = activeChapterId ? findNode(nodes, activeChapterId) : undefined;
  const chapterParent: ContainerRef = React.useMemo(() => {
    if (activeChapter) return activeChapter.parent;
    const lastArc = flattenTree(nodes)
      .reverse()
      .find((item) => item.type === "arc");
    return lastArc ? { kind: "arc", id: lastArc.id } : ROOT;
  }, [nodes, activeChapter]);
  const arcParent = activeChapter ? enclosingVolume(nodes, activeChapter.parent) : ROOT;

  // One pass over the tree per change, rather than a walk inside every container row.
  // The arrays are stable identities, which is what useLiveTotal wants.
  const subtrees = React.useMemo(() => {
    const map = new Map<string, { id: string; wordCount: number }[]>();
    for (const node of nodes) {
      const own = asContainer(node);
      if (!own) continue;
      map.set(
        node.id,
        descendantChapters(nodes, own).map((chapter) => ({ id: chapter.id, wordCount: chapter.wordCount ?? 0 })),
      );
    }
    return map;
  }, [nodes]);

  /*
   * Roving tabindex. One row in the whole tree is tabbable — the active chapter if it is
   * visible, otherwise the first row — and the arrows move between them. Every row being a
   * tab stop meant a keyboard user had to walk the entire serial to reach the manuscript.
   */
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const tabStopId = React.useMemo(() => {
    const ids = flat.map((item) => item.id);
    if (focusedId && ids.includes(focusedId)) return focusedId;
    if (activeChapterId && ids.includes(activeChapterId)) return activeChapterId;
    return ids[0] ?? null;
  }, [flat, focusedId, activeChapterId]);

  const navigate = React.useCallback(
    (fromId: string, key: string) => {
      const index = flat.findIndex((item) => item.id === fromId);
      if (index < 0) return;
      const target =
        key === "ArrowDown"
          ? Math.min(flat.length - 1, index + 1)
          : key === "ArrowUp"
            ? Math.max(0, index - 1)
            : key === "Home"
              ? 0
              : flat.length - 1;
      const next = flat[target];
      if (!next || next.id === fromId) return;
      setFocusedId(next.id);
      // The rows are plain elements in a scroll container; move focus by id.
      document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(next.id)}"]`)?.focus();
    },
    [flat],
  );

  /*
   * Multi-select.
   *
   * Off by default and turned on from the binder's own chrome, rather than living on
   * ctrl-click: a modifier nobody is told about is not a feature. With it on, a click picks
   * instead of opening, shift-click takes the range since the last pick, and a container
   * stands for every chapter beneath it — which is the whole point, since "queue this arc" is
   * the thing a writer actually wants to say.
   *
   * The selection holds chapter ids only. Containers are a way of *expressing* a selection,
   * not a thing that can be in one — a bulk delete that could take an arc with it would be a
   * different and much more dangerous action than the one this offers.
   */
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [lastPicked, setLastPicked] = React.useState<string | null>(null);

  // Chapters currently on screen, in display order — what a shift-range walks along.
  const visibleChapterIds = React.useMemo(
    () => flat.filter((item) => item.type === "chapter").map((item) => item.id),
    [flat],
  );

  const chaptersUnder = React.useCallback(
    (item: FlatNode): string[] => {
      const own = asContainer(item);
      if (!own) return [item.id];
      return (subtrees.get(item.id) ?? NO_CHAPTERS).map((chapter) => chapter.id);
    },
    [subtrees],
  );

  const toggleSelection = (item: FlatNode, extend: boolean) => {
    const ids = chaptersUnder(item);
    if (ids.length === 0) return;

    setSelected((previous) => {
      const next = new Set(previous);
      // Shift takes everything between the last pick and this one, which for a container means
      // from the last pick to the end of that container.
      if (extend && lastPicked && item.type === "chapter") {
        const from = visibleChapterIds.indexOf(lastPicked);
        const to = visibleChapterIds.indexOf(item.id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from <= to ? [from, to] : [to, from];
          for (const id of visibleChapterIds.slice(start, end + 1)) next.add(id);
          return next;
        }
      }
      // A container toggles as a unit: all on unless every one of its chapters is already on.
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    if (item.type === "chapter") setLastPicked(item.id);
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setLastPicked(null);
  };

  /*
   * What a bulk action would actually touch: the picks that are still on screen.
   *
   * Derived rather than pruned in an effect, which matters twice over. Pruning would cascade a
   * second render on every filter change, and it would also *forget* — turn a filter on, and
   * the chapters it hides would be dropped from the selection for good. Intersecting at render
   * keeps them, so clearing the filter brings them back, while nothing off screen can be acted
   * on in the meantime.
   */
  const activeSelection = React.useMemo(() => {
    const visible = new Set(visibleChapterIds);
    return new Set([...selected].filter((id) => visible.has(id)));
  }, [selected, visibleChapterIds]);

  const runBulk = (run: () => Promise<ActionResult<{ count: number }>>, describe: (count: number) => string) => {
    startBulk(async () => {
      const response = await run();
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success(describe(response.count));
      stopSelecting();
    });
  };

  const handleBulkStatus = (status: ChapterStatus) =>
    runBulk(
      () => setChaptersStatus({ novelId, chapterIds: [...activeSelection], status }),
      (count) => `${pluralize(count, "chapter")} set to ${STATUS_META[status].label}`,
    );

  const handleBulkDelete = () =>
    runBulk(
      () => deleteChapters({ novelId, chapterIds: [...activeSelection] }),
      (count) => `${pluralize(count, "chapter")} deleted`,
    );

  const openChapter = (chapterId: string) => router.push(`/novels/${novelId}/chapters/${chapterId}`);

  const handleCreateChapter = async (parent: ContainerRef) => {
    const response = await createChapter({ novelId, parent });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    expand(parent);
    openChapter(response.id);
  };

  const handleStatus = async (node: BinderNode, status: ChapterStatus) => {
    const previous = nodes;
    setNodes(nodes.map((entry) => (entry.id === node.id ? { ...entry, status } : entry)));
    const response = await setChapterStatus({ chapterId: node.id, status });
    if (!response.ok) {
      setNodes(previous);
      toast.error(response.error);
    }
  };

  const handleRowAction = (node: BinderNode, action: RowAction) => {
    switch (action.kind) {
      case "open":
        openChapter(node.id);
        break;
      case "rename":
        setDialog({ mode: "rename", node });
        break;
      case "delete":
        setDialog({ mode: "delete", node });
        break;
      case "new-chapter":
        void handleCreateChapter(asContainer(node) ?? ROOT);
        break;
      case "new-arc":
        setDialog({ mode: "create", type: "arc", parent: asContainer(node) ?? ROOT });
        break;
      case "status":
        void handleStatus(node, action.status);
        break;
    }
  };

  const submitTitle = async (value: string): Promise<boolean> => {
    if (!dialog || dialog.mode === "delete") return true;
    if (dialog.mode === "rename") {
      const response = await renameNode({ novelId, type: dialog.node.type, id: dialog.node.id, title: value });
      if (!response.ok) {
        toast.error(response.error);
        return false;
      }
      setNodes(nodes.map((entry) => (entry.id === dialog.node.id ? { ...entry, title: value } : entry)));
      return true;
    }
    const response =
      dialog.type === "arc"
        ? await createArc({ novelId, parent: dialog.parent, title: value })
        : await createVolume({ novelId, title: value });
    if (!response.ok) {
      toast.error(response.error);
      return false;
    }
    expand(dialog.parent);
    toast.success(`${NODE_TYPE_LABEL[dialog.type]} created`);
    return true;
  };

  const confirmDelete = async (): Promise<boolean> => {
    if (!dialog || dialog.mode !== "delete") return true;
    const response = await deleteNode({ novelId, type: dialog.node.type, id: dialog.node.id });
    if (!response.ok) {
      toast.error(response.error);
      return false;
    }
    if (dialog.node.id === activeChapterId) router.push(`/novels/${novelId}`);
    return true;
  };

  const titleDialogOpen = dialog?.mode === "rename" || dialog?.mode === "create";

  return (
    <nav aria-label="Serial binder" className="flex h-full min-h-0 flex-col">
      <PanelChrome className="justify-between pr-2 pl-3">
        <span className="label-section">Binder</span>
        <span className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={selecting ? "Stop selecting" : "Select several chapters"}
            aria-pressed={selecting}
            className={selecting ? "text-press" : undefined}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          >
            <ListChecks />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={statusFilter ? `Filtered to ${STATUS_META[statusFilter].label}` : "Filter by status"}
                  className={filtering ? "text-press" : undefined}
                />
              }
            >
              <ListFilter />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={statusFilter ?? "ALL"}
                onValueChange={(value) => setStatusFilter(value === "ALL" ? null : (value as ChapterStatus))}
              >
                <DropdownMenuRadioItem value="ALL">Every chapter</DropdownMenuRadioItem>
                {CHAPTER_STATUSES.map((status) => (
                  <DropdownMenuRadioItem key={status} value={status}>
                    <StatusDot status={status} /> {STATUS_META[status].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Add to binder" />}>
            <Plus />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => void handleCreateChapter(chapterParent)}>
              <FileText /> New chapter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog({ mode: "create", type: "arc", parent: arcParent })}>
              <Milestone /> New arc
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog({ mode: "create", type: "volume", parent: ROOT })}>
              <BookOpen /> New volume
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </span>
      </PanelChrome>

      {filtering && statusFilter && (
        <div className="flex shrink-0 items-center gap-2 border-b border-divider px-3 py-1.5">
          <StatusDot status={statusFilter} />
          <span className="min-w-0 flex-1 truncate text-2xs text-subtle">
            {pluralize(matchCount, "chapter")} · reordering is off while filtered
          </span>
          <Button variant="ghost" size="xs" className="text-subtle" onClick={() => setStatusFilter(null)}>
            Clear
          </Button>
        </div>
      )}

      <div
        role="tree"
        aria-label="Chapters and arcs"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2"
      >
        {flat.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing in the binder yet.</p>
            <Button size="sm" className="mt-3" onClick={() => void handleCreateChapter(ROOT)}>
              <Plus /> First chapter
            </Button>
          </div>
        ) : (
          <DndContext
            id="binder-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={resetDrag}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {flat.map((item) => {
                const own = asContainer(item);
                return (
                  <BinderRow
                    key={item.id}
                    item={item}
                    subtree={subtrees.get(item.id) ?? NO_CHAPTERS}
                    runNumber={runNumbers.get(item.id)}
                    dragDisabled={filtering || selecting}
                    isTabStop={item.id === tabStopId}
                    onFocusRow={() => setFocusedId(item.id)}
                    onKeyNavigate={(key) => navigate(item.id, key)}
                    indent={INDENT}
                    depth={item.id === activeId && projection ? projection.depth : item.depth}
                    collapsed={own ? collapsed.has(containerKey(own)) : false}
                    isActiveChapter={item.id === activeChapterId}
                    isDragging={item.id === activeId}
                    selecting={selecting}
                    selected={
                      selecting &&
                      (item.type === "chapter"
                        ? selected.has(item.id)
                        : (subtrees.get(item.id) ?? NO_CHAPTERS).length > 0 &&
                          (subtrees.get(item.id) ?? NO_CHAPTERS).every((chapter) => selected.has(chapter.id)))
                    }
                    onSelect={(extend) => toggleSelection(item, extend)}
                    onToggle={() => own && toggleCollapsed(containerKey(own))}
                    onAction={(action) => handleRowAction(item, action)}
                  />
                );
              })}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeItem ? <BinderRowGhost item={activeItem} descendants={countDescendants(nodes, activeItem)} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/*
        Creating a volume used to mean finding it inside a row's hover menu, and there was no
        sign anywhere that volumes existed at all. Three plain buttons at the end of the tree
        say what the hierarchy is and make each level one click away.
      */}
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1">
        <Button variant="ghost" size="xs" className="text-subtle" onClick={() => void handleCreateChapter(chapterParent)}>
          <FileText /> Chapter
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-subtle"
          onClick={() => setDialog({ mode: "create", type: "arc", parent: arcParent })}
        >
          <Milestone /> Arc
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-subtle"
          onClick={() => setDialog({ mode: "create", type: "volume", parent: ROOT })}
        >
          <BookOpen /> Volume
        </Button>
      </div>

      {/*
        The bulk bar. It replaces the "drag to reorder" footnote while a selection is live,
        because a strip that says two different things at once says neither.
      */}
      {selecting && (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-divider bg-chrome px-2 py-2">
          <div className="flex items-center gap-2 px-1">
            <span className="min-w-0 flex-1 truncate text-2xs text-subtle">
              {activeSelection.size === 0
                ? "Pick chapters — shift-click for a run"
                : `${pluralize(activeSelection.size, "chapter")} selected`}
            </span>
            <Button variant="ghost" size="xs" className="text-subtle" onClick={stopSelecting} disabled={bulkPending}>
              Done
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {CHAPTER_STATUSES.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="xs"
                disabled={activeSelection.size === 0 || bulkPending}
                onClick={() => handleBulkStatus(status)}
              >
                <StatusDot status={status} /> {STATUS_META[status].label}
              </Button>
            ))}
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="xs"
              className="text-proof hover:bg-proof/10"
              disabled={activeSelection.size === 0 || bulkPending}
              onClick={() => setBulkDeleting(true)}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      )}

      {!selecting && (
        <PanelFootnote>Drag right to nest inside an arc or volume.</PanelFootnote>
      )}

      <TitleDialog
        open={titleDialogOpen}
        onOpenChange={(open) => !open && setDialog(null)}
        heading={
          dialog?.mode === "rename"
            ? `Rename ${NODE_TYPE_LABEL[dialog.node.type].toLowerCase()}`
            : dialog?.mode === "create"
              ? `New ${NODE_TYPE_LABEL[dialog.type].toLowerCase()}`
              : ""
        }
        initialValue={
          dialog?.mode === "rename" ? dialog.node.title : dialog?.mode === "create" ? suggestTitle(nodes, dialog.type) : ""
        }
        submitLabel={dialog?.mode === "rename" ? "Rename" : "Create"}
        onSubmit={submitTitle}
      />
      <ConfirmDialog
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        title={`Delete ${pluralize(activeSelection.size, "chapter")}?`}
        description="Deleted for good, with their notes and history. Arcs and volumes are untouched."
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <DeleteDialog
        open={dialog?.mode === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        node={dialog?.mode === "delete" ? dialog.node : null}
        onConfirm={confirmDelete}
      />
    </nav>
  );
}
