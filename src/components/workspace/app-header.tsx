"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BookMarked, CalendarClock, Download, PanelLeft, PanelRight, Search } from "lucide-react";

import { findNode, flattenTree, type BinderNode } from "@/lib/binder/tree";
import { capabilitiesFor, type PlanId } from "@/lib/billing/plans";
import type { NovelSummary } from "@/lib/data/novels";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExportDialog } from "@/components/export/export-dialog";
import { CommandPalette } from "@/components/workspace/command-palette";
import { ShortcutsDialog } from "@/components/workspace/shortcuts-dialog";
import {
  setBinderOpen,
  setCommandOpen,
  toggleFocusMode,
  useWorkspaceLayout,
} from "@/components/workspace/layout-store";

import { AccountMenu } from "./account-menu";
import { NovelSwitcher } from "./novel-switcher";
import { Wordmark } from "./wordmark";

/** "Volume 1 › Arc 2 › Chapter 5" for the chapter currently open. */
function chapterCrumbs(nodes: BinderNode[], chapterId: string | undefined): string[] {
  if (!chapterId) return [];
  const chapter = findNode(nodes, chapterId);
  if (!chapter) return [];
  const crumbs = [chapter.title];
  let container = chapter.parent;
  while (container.kind !== "root") {
    const parent = findNode(nodes, container.id);
    if (!parent) break;
    crumbs.unshift(parent.title);
    container = parent.parent;
  }
  return crumbs;
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function AppHeader({
  novel,
  novels,
  nodes,
  user,
  sweetSpotMin,
}: {
  novel: { id: string; title: string };
  novels: NovelSummary[];
  nodes: BinderNode[];
  user: { penName: string; email: string; plan: string };
  /** Passed through to the export dialog, which flags a chapter short of the writer's band. */
  sweetSpotMin: number;
}) {
  const plan = user.plan as PlanId;
  const canBuffer = capabilitiesFor(plan).buffer;
  const router = useRouter();
  const params = useParams<{ chapterId?: string }>();
  const crumbs = chapterCrumbs(nodes, params.chapterId);
  const [exporting, setExporting] = React.useState(false);
  const { binderOpen, commandOpen, focusMode } = useWorkspaceLayout();
  const chapterId = params.chapterId ?? null;
  const chapterTitle = chapterId ? (findNode(nodes, chapterId)?.title ?? "Chapter") : "";

  /*
   * Workspace shortcuts. ⌘K lives in the palette itself; these are the ones that only make
   * sense with the binder tree to hand. They deliberately do nothing while the caret is in a
   * text field unless they carry a modifier the field would not use itself.
   */
  React.useEffect(() => {
    const chapters = flattenTree(nodes).filter((node) => node.type === "chapter");

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key === "\\") {
        event.preventDefault();
        toggleFocusMode();
        return;
      }
      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        if (!chapterId) return;
        event.preventDefault();
        const index = chapters.findIndex((chapter) => chapter.id === chapterId);
        if (index < 0) return;
        const next = chapters[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) router.push(`/novels/${novel.id}/chapters/${next.id}`);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes, chapterId, novel.id, router]);

  return (
    /*
     * Everything past the wordmark sheds a label before it sheds a control.
     *
     * This row used to be fixed-width all the way across: it needed about 610px, and the
     * shell's overlay layout starts at 1023px, so between those two the right-hand cluster —
     * both panel toggles, the palette, the Codex and Export — was simply painted past the
     * edge of the viewport, unreachable, with nothing to scroll. On a phone that is most of
     * the app's chrome. The controls all stay; what goes at each step is text that is said
     * again somewhere else. The breadcrumb is above the manuscript, the wordmark is a mark
     * on its own, and the two button labels have tooltips and aria-labels.
     */
    <header className="flex h-header shrink-0 items-center gap-2 border-b border-divider bg-chrome px-3">
      <Link href="/library" className="focus-ring shrink-0 rounded-md pr-1" aria-label="Your library">
        <Wordmark nameClassName="hidden sm:inline" />
      </Link>
      <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
      <div className="min-w-0 shrink">
        <NovelSwitcher novels={novels} current={novel} />
      </div>

      <div className="hidden min-w-0 flex-1 truncate px-4 text-center text-xs text-muted-foreground lg:block">
        {crumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="mx-1.5 text-subtle">›</span>}
            <span className={index === crumbs.length - 1 ? "text-foreground/80" : undefined}>{crumb}</span>
          </React.Fragment>
        ))}
      </div>
      <span className="flex-1 lg:hidden" />

      {/* The panels are collapsible now, so they need a visible way back. */}
      <PanelToggle
        label={binderOpen ? "Hide the binder" : "Show the binder"}
        active={binderOpen}
        onClick={() => setBinderOpen(!binderOpen)}
      >
        <PanelLeft />
      </PanelToggle>
      <PanelToggle
        label={commandOpen ? "Hide the command centre" : "Show the command centre"}
        active={commandOpen}
        onClick={() => setCommandOpen(!commandOpen)}
        shortcut={focusMode ? undefined : undefined}
      >
        <PanelRight />
      </PanelToggle>

      <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="sm" className="gap-1.5 px-2 text-subtle sm:px-2.5" aria-label="Open the command palette" />}
          onClick={() => {
            // The palette owns the shortcut; clicking simply plays it back.
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: !isMac(), metaKey: isMac(), bubbles: true }),
            );
          }}
        >
          <Search />
          <kbd className="hidden font-sans text-2xs md:inline">{isMac() ? "⌘" : "Ctrl "}K</kbd>
        </TooltipTrigger>
        <TooltipContent>Search and commands</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-sm" className="text-subtle" aria-label="Open the Codex" />}
          onClick={() => router.push(`/novels/${novel.id}/codex`)}
        >
          <BookMarked />
        </TooltipTrigger>
        <TooltipContent>Codex</TooltipContent>
      </Tooltip>

      {/* The Buffer is a Serial feature. Its route redirects a Drawer writer to the pricing
          page, but a control that always bounces you is a trap, so it is simply not drawn. */}
      {canBuffer && (
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon-sm" className="text-subtle" aria-label="Open the Buffer" />}
            onClick={() => router.push(`/novels/${novel.id}/buffer`)}
          >
            <CalendarClock />
          </TooltipTrigger>
          <TooltipContent>The buffer</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 px-2 md:px-2.5"
              disabled={!chapterId}
              aria-label="Export"
            />
          }
          onClick={() => setExporting(true)}
        >
          <Download />
          <span className="hidden md:inline">Export</span>
        </TooltipTrigger>
        <TooltipContent>Export this chapter</TooltipContent>
      </Tooltip>

      <AccountMenu user={{ penName: user.penName, email: user.email, plan }} className="ml-1" />

      <CommandPalette novelId={novel.id} nodes={nodes} onExport={() => setExporting(true)} />
      <ShortcutsDialog />

      <ExportDialog
        open={exporting}
        onOpenChange={setExporting}
        novelId={novel.id}
        nodes={nodes}
        chapterId={chapterId}
        chapterTitle={chapterTitle}
        plan={plan}
        sweetSpotMin={sweetSpotMin}
      />
    </header>
  );
}

function PanelToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
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
            className={active ? "text-foreground" : "text-subtle"}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
