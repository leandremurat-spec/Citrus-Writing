"use client";

import * as React from "react";
import { useSortable, type AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  GripVertical,
  Milestone,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { CHAPTER_STATUSES, STATUS_META, isChapterStatus } from "@/lib/binder/status";
import type { ChapterStatus, FlatNode, NodeType } from "@/lib/binder/tree";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useLiveCount, useLiveTotal } from "@/components/workspace/live-chapter";

import { StatusDot } from "./status-badge";

export type RowAction =
  | { kind: "open" }
  | { kind: "rename" }
  | { kind: "delete" }
  | { kind: "new-chapter" }
  | { kind: "new-arc" }
  | { kind: "status"; status: ChapterStatus };

export const NODE_ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  volume: BookOpen,
  arc: Milestone,
  chapter: FileText,
};

// Skip layout animations while sorting so rows don't wobble as children collapse away.
const animateLayoutChanges: AnimateLayoutChanges = ({ isSorting, wasDragging }) => !(isSorting || wasDragging);

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

// Three tiers a glance can separate: a tracked uppercase volume, a solid arc, a quieter
// chapter. Indentation alone was doing this job and it could not.
function titleClass(type: NodeType, active: boolean): string {
  if (type === "volume") return "label-section";
  if (type === "arc") return "font-medium text-foreground";
  return active ? "text-foreground" : "text-foreground/75";
}

interface BinderRowProps {
  item: FlatNode;
  /** Position in the novel's run of chapters, derived from document order. Containers
   * have none. */
  runNumber?: number;
  /** Off while a status filter is on: reordering against a partial list would move rows
   * past siblings that are not on screen. */
  dragDisabled: boolean;
  /** Roving tabindex: exactly one row in the tree is a tab stop. */
  isTabStop: boolean;
  onFocusRow: () => void;
  onKeyNavigate: (key: string) => void;
  /** Every chapter beneath this row, memoised by the binder. Empty for chapters. */
  subtree: readonly { id: string; wordCount: number }[];
  /** Depth to render at: the projected depth while this row is being dragged. */
  depth: number;
  indent: number;
  collapsed: boolean;
  isActiveChapter: boolean;
  isDragging: boolean;
  /** Selection mode is on for the whole tree; every row shows a checkbox in place of its badge. */
  selecting: boolean;
  selected: boolean;
  /** `extend` is true for a shift-click, which selects the range since the last one. */
  onSelect: (extend: boolean) => void;
  onToggle: () => void;
  onAction: (action: RowAction) => void;
}

export function BinderRow({
  item,
  subtree,
  runNumber,
  dragDisabled,
  isTabStop,
  onFocusRow,
  onKeyNavigate,
  depth,
  indent,
  collapsed,
  isActiveChapter,
  isDragging,
  selecting,
  selected,
  onSelect,
  onToggle,
  onAction,
}: BinderRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: item.id,
    animateLayoutChanges,
    disabled: dragDisabled,
  });
  // Both row menus, because either one being open has to keep the tools cluster in the layout.
  // The cluster is display:none until `group-hover/row` or `group-focus-within/row` matches,
  // and a Base UI popup portals to <body> — so the moment a menu opens, focus leaves the row,
  // neither selector matches, and the trigger the popup is anchored to is removed from layout.
  // The popup then repositions to 0,0 and closes: it appears in the top-left corner and
  // vanishes from under the pointer. The "…" menu already tracked its own state for this
  // reason; the "+" menu did not, which is why adding a chapter to an arc was the one that
  // misbehaved.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const anyMenuOpen = menuOpen || addOpen;
  const liveWordCount = useLiveCount(item.id, item.wordCount ?? 0);
  // Containers show the sum of every chapter beneath them, live.
  const subtreeWords = useLiveTotal(subtree);
  const isContainer = item.type !== "chapter";
  const Icon = NODE_ICONS[item.type];
  // dnd-kit hands back an inline `transition` covering `transform` only, and an inline style
  // replaces the class's `transition-colors` outright — so the row's hover tint has always
  // snapped rather than faded. Append ours instead of letting one clobber the other.
  // The reduced-motion guard still reaches this: an `!important` rule outranks inline styles.
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: [transition, "background-color var(--duration-tint) var(--ease-state)"]
      .filter(Boolean)
      .join(", "),
  };
  const activate = (event?: React.MouseEvent) => {
    // While selecting, a click picks rather than opens — including on a container, which stands
    // for every chapter beneath it. Expanding is still available from the chevron.
    if (selecting) {
      onSelect(event?.shiftKey ?? false);
      return;
    }
    if (isContainer) onToggle();
    else onAction({ kind: "open" });
  };
  // On hover (or while the menu is open) the word count gives way to the grip and menu buttons,
  // so the row never reserves empty space and titles keep as much room as possible.
  const showTools = "group-hover/row:flex group-focus-within/row:flex";
  const hideMeta = "group-hover/row:hidden group-focus-within/row:hidden";

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={setNodeRef}
        style={style}
        data-row-id={item.id}
        // A tree is one tab stop, not one per row: tabbing through a 200-chapter serial to
        // reach the editor is not navigation, it is an obstacle. Arrow keys move within.
        role="treeitem"
        tabIndex={isTabStop ? 0 : -1}
        aria-level={depth + 1}
        aria-expanded={isContainer && item.hasChildren ? !collapsed : undefined}
        aria-current={isActiveChapter ? "page" : undefined}
        aria-selected={selecting ? selected : undefined}
        onFocus={onFocusRow}
        className={cn(
          // No `transition-*` here: the inline style above owns this row's transition.
          "group/row relative my-px flex h-8 items-center gap-1 rounded-full pr-2.5 text-sm outline-none",
          "focus-ring-inset",
          isDragging ? "bg-press/5 opacity-40 ring-1 ring-press/50" : "hover:bg-muted/60",
          isActiveChapter && !isDragging && "bg-press-200 shadow-e0",
          selecting && selected && !isDragging && "bg-press-100 ring-1 ring-press/40",
        )}
        onClick={(event) => activate(event)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
            return;
          }
          // Arrow keys are the tree's own navigation; left/right also open and close a
          // container, which is what the treeitem role promises a screen-reader user.
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            onKeyNavigate(event.key);
            return;
          }
          if (event.key === "ArrowRight" && isContainer && collapsed) {
            event.preventDefault();
            onToggle();
            return;
          }
          if (event.key === "ArrowLeft" && isContainer && !collapsed) {
            event.preventDefault();
            onToggle();
          }
        }}
        onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined}
      >
        <span aria-hidden className="shrink-0" style={{ width: depth * indent }} />

        {/*
          The run number, as a filled circle rather than plain text — matching how the Run
          band numbers the same chapters. Containers get the same width of empty space so
          every title in the tree starts on one line, which is what makes the column read as
          a column rather than as a prefix. The slot is a fixed width regardless of the
          active/inactive badge's own size, for the same reason.
        */}
        <span className="flex size-8 shrink-0 items-center justify-center">
          {selecting ? (
            <span
              aria-hidden
              className={cn(
                "flex size-4 items-center justify-center rounded-[6px] border transition-colors duration-tint ease-state",
                selected ? "border-press bg-press text-press-foreground" : "border-neutral-600 bg-transparent",
              )}
            >
              {selected && <Check className="size-3" strokeWidth={3} />}
            </span>
          ) : null}
          {!selecting && item.type === "chapter" && runNumber !== undefined && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full font-bold tabular-nums",
                isActiveChapter
                  ? "size-8 bg-press text-sm text-press-foreground"
                  : "size-[26px] bg-muted text-2xs text-foreground/80",
              )}
            >
              {runNumber}
            </span>
          )}
        </span>

        {isContainer ? (
          <button
            type="button"
            tabIndex={-1}
            // Not a tab stop by design: the row itself carries aria-expanded and Left/Right
            // open and close it, so this is a mouse affordance rather than a second control
            // a keyboard user has to walk past on every row.
            aria-hidden
            aria-label={collapsed ? "Expand" : "Collapse"}
            onPointerDown={stop}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="focus-ring-inset flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-state ease-state",
                !collapsed && item.hasChildren && "rotate-90",
                !item.hasChildren && "opacity-30",
              )}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        {/* Chapters carry their own marker in the run-number badge above; the icon is what
            tells arcs and volumes apart from each other and from a chapter. */}
        {isContainer && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className={cn("min-w-12 flex-1 truncate", titleClass(item.type, isActiveChapter))}>{item.title}</span>

        <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          <span className={cn("flex items-center gap-1.5", hideMeta, anyMenuOpen && "hidden")}>
            <span className="text-2xs text-subtle tabular-nums">
              {formatCompact(isContainer ? subtreeWords : liveWordCount)}
            </span>
            {item.type === "chapter" && (
              <StatusDot
                status={item.status ?? "DRAFT"}
                className="mx-0.5"
                title={STATUS_META[item.status ?? "DRAFT"].label}
              />
            )}
          </span>

          <span className={cn("hidden items-center", showTools, anyMenuOpen && "flex")}>
            {!dragDisabled && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined}
              onClick={stop}
              aria-label={`Drag ${item.title}`}
              className="focus-ring-inset flex size-5 cursor-grab items-center justify-center rounded text-subtle hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-3.5" />
            </button>
            )}

            {isContainer && (
              <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-xs" aria-label={`Add inside ${item.title}`} />}
                  onPointerDown={stop}
                  onClick={stop}
                >
                  <Plus />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onAction({ kind: "new-chapter" })}>
                    <FileText /> New chapter
                  </DropdownMenuItem>
                  {item.type === "volume" && (
                    <DropdownMenuItem onClick={() => onAction({ kind: "new-arc" })}>
                      <Milestone /> New arc
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-xs" aria-label="More actions" />}
                onPointerDown={stop}
                onClick={stop}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <RowMenu parts={dropdownParts} item={item} onAction={onAction} />
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </span>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <RowMenu parts={contextParts} item={item} onAction={onAction} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** What follows the pointer while dragging. */
export function BinderRowGhost({ item, descendants }: { item: FlatNode; descendants: number }) {
  const Icon = NODE_ICONS[item.type];
  return (
    <div className="flex h-8 w-64 items-center gap-2 rounded-md border border-press/40 bg-popover px-2 text-sm shadow-e3">
      <Icon className="size-4 shrink-0 text-press" />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {descendants > 0 && <span className="text-2xs text-muted-foreground">+{descendants}</span>}
    </div>
  );
}

// ---------- the action menu, shared by the "…" button and the right-click menu ----------

interface MenuItemProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "destructive";
}
interface MenuParts {
  Item: React.ComponentType<MenuItemProps>;
  Separator: React.ComponentType;
  Sub: React.ComponentType<{ children?: React.ReactNode }>;
  SubTrigger: React.ComponentType<{ children?: React.ReactNode }>;
  SubContent: React.ComponentType<{ children?: React.ReactNode; className?: string }>;
  RadioGroup: React.ComponentType<{ children?: React.ReactNode; value: string; onValueChange: (value: string) => void }>;
  RadioItem: React.ComponentType<{ children?: React.ReactNode; value: string }>;
}

const dropdownParts: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
};

const contextParts: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
};

function RowMenu({ parts: M, item, onAction }: { parts: MenuParts; item: FlatNode; onAction: (action: RowAction) => void }) {
  const isChapter = item.type === "chapter";
  return (
    <>
      {!isChapter && (
        <M.Item onClick={() => onAction({ kind: "new-chapter" })}>
          <Plus /> New chapter inside
        </M.Item>
      )}
      {item.type === "volume" && (
        <M.Item onClick={() => onAction({ kind: "new-arc" })}>
          <Milestone /> New arc inside
        </M.Item>
      )}
      {isChapter && (
        <M.Sub>
          <M.SubTrigger>
            <CircleDot /> Status
          </M.SubTrigger>
          <M.SubContent className="w-40">
            <M.RadioGroup
              value={item.status ?? "DRAFT"}
              onValueChange={(value) => {
                if (isChapterStatus(value)) onAction({ kind: "status", status: value });
              }}
            >
              {CHAPTER_STATUSES.map((status) => (
                <M.RadioItem key={status} value={status}>
                  <StatusDot status={status} /> {STATUS_META[status].label}
                </M.RadioItem>
              ))}
            </M.RadioGroup>
          </M.SubContent>
        </M.Sub>
      )}
      {!isChapter && <M.Separator />}
      <M.Item onClick={() => onAction({ kind: "rename" })}>
        <Pencil /> Rename
      </M.Item>
      <M.Separator />
      <M.Item variant="destructive" onClick={() => onAction({ kind: "delete" })}>
        <Trash2 /> Delete{isChapter ? " chapter" : ""}…
      </M.Item>
    </>
  );
}
