"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  DEFAULT_SIZES,
  loadPanelSizes,
  rememberPanelSize,
  setBinderOpen,
  setCommandOpen,
  startRecordingSizes,
  stopRecordingSizes,
  useNarrowLayout,
  useWorkspaceLayout,
} from "@/components/workspace/layout-store";

/**
 * The three-panel frame: Serial Binder | Writing Canvas | Command Center.
 * Lives in the novel layout so panel sizes survive navigating between chapters.
 *
 * A hidden panel is *not rendered*, rather than collapsed to zero width. The library's
 * imperative `collapse()` loses to its own layout solver when the group is tight, which is
 * exactly when hiding a panel matters most; leaving the panel out of the tree cannot be
 * argued with. It also means focus mode really does stop the codex and the binder doing work.
 *
 * Below 1024px the two side panels become overlays instead of columns. Three resizable
 * columns need about 900px before the manuscript is squeezed to a ribbon, and the shell used
 * to simply refuse to go below that.
 *
 * The Codex and Buffer routes drop the Command Centre column entirely — their `@panel` slots
 * render `null` (see `@panel/codex/page.tsx` and `@panel/buffer/page.tsx`) so nothing wrong
 * shows there, but that alone does not collapse the column: Next wraps every parallel-route
 * slot in its own internal element before it reaches this component, so `panel` here is never
 * strictly `null` even when the leaf page returns it — comparing it against `null` silently
 * never matches. The route itself is what these two screens actually have in common, so this
 * checks the pathname instead, the same way `RunBand` already decides whether to render at
 * all. This never touches the user's actual `commandOpen` preference, which is still what a
 * chapter route reads when they navigate back.
 */
export function WorkspaceShell({
  binder,
  panel,
  children,
}: {
  binder: React.ReactNode;
  panel: React.ReactNode;
  children: React.ReactNode;
}) {
  const { binderOpen, commandOpen } = useWorkspaceLayout();
  const pathname = usePathname() ?? "";
  const hidesCommandCentre = /\/(codex|buffer)(\/|$)/.test(pathname);
  const showCommand = commandOpen && !hidesCommandCentre;
  const narrow = useNarrowLayout();
  const binderRef = React.useRef<PanelImperativeHandle>(null);
  const commandRef = React.useRef<PanelImperativeHandle>(null);

  /*
   * The remembered widths are applied *after* mount, never read during render.
   *
   * `defaultSize` is part of the server-rendered markup, so reading localStorage for it
   * hydrates a different `flex-basis` than the server sent and React reports a mismatch.
   * The panels therefore render at the shared defaults — which is exactly what the server
   * rendered — and resize themselves once the client is in charge.
   *
   * The resize cannot throw, and retries once on a timer.
   *
   * A panel handed to `resize()` in the same commit that *added* it to an already-mounted
   * group has a ref but no layout yet: the group only recomputes its layout in a later
   * render pass. Calling `resize()` before that threw "Layout not found for Panel …" — out
   * of an effect, with no error boundary above it, so it took the whole workspace down.
   * Every route into this branch hit it: showing either panel again, leaving focus mode, and
   * navigating back to a chapter from the Codex or the Buffer, both of which drop the command
   * centre so returning re-adds it. The panel toggles in the header were fatal on the second
   * click, which is about as central a control as this app has.
   *
   * So the retry is the point, not the catch: swallowing the failure alone would leave a
   * re-shown panel at its default width instead of the remembered one. A timer rather than
   * `requestAnimationFrame`, because rAF does not fire while the page is hidden and a panel
   * toggled in a background tab would then never get its width back.
   */
  React.useEffect(() => {
    // Runs on mount and on every toggle, both of which rebuild the panels at their defaults.
    stopRecordingSizes();
    const stored = loadPanelSizes();

    /** Returns true if anything still needs another go. */
    const apply = (): boolean => {
      let pending = false;
      const restore = (panel: PanelImperativeHandle | null, size: number) => {
        if (!panel) return;
        try {
          panel.resize(size);
        } catch {
          pending = true; // Not in the group's layout yet.
        }
      };
      if (binderOpen) restore(binderRef.current, stored.binder);
      if (showCommand) restore(commandRef.current, stored.command);
      return pending;
    };

    if (!apply()) return;
    const timer = setTimeout(apply, 0);
    return () => clearTimeout(timer);
  }, [binderOpen, showCommand]);

  if (narrow) {
    return (
      <div className="relative h-full">
        <div className="h-full bg-background">{children}</div>

        {binderOpen && (
          <Overlay side="left" label="Serial binder" onClose={() => setBinderOpen(false)}>
            {binder}
          </Overlay>
        )}
        {showCommand && (
          <Overlay side="right" label="Command centre" onClose={() => setCommandOpen(false)}>
            {panel}
          </Overlay>
        )}
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {binderOpen && (
        <>
          <ResizablePanel
            panelRef={binderRef}
            defaultSize={DEFAULT_SIZES.binder}
            minSize={200}
            maxSize={460}
            onResize={(size) => rememberPanelSize("binder", size.inPixels)}
            className="bg-chrome"
          >
            {binder}
          </ResizablePanel>
          <ResizableHandle
            className="hover:after:bg-press/50"
            aria-label="Resize the binder"
            onPointerDown={startRecordingSizes}
            onKeyDown={startRecordingSizes}
          />
        </>
      )}

      <ResizablePanel minSize={340} className="bg-background">
        {children}
      </ResizablePanel>

      {showCommand && (
        <>
          <ResizableHandle
            className="hover:after:bg-press/50"
            aria-label="Resize the command centre"
            onPointerDown={startRecordingSizes}
            onKeyDown={startRecordingSizes}
          />
          <ResizablePanel
            panelRef={commandRef}
            defaultSize={DEFAULT_SIZES.command}
            minSize={260}
            maxSize={520}
            onResize={(size) => rememberPanelSize("command", size.inPixels)}
            className="bg-chrome"
          >
            {panel}
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

/** A side panel as a sheet over the canvas, for widths that cannot hold three columns. */
function Overlay({
  side,
  label,
  onClose,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`Close ${label.toLowerCase()}`}
        onClick={onClose}
        className="absolute inset-0 z-40 cursor-default bg-black/40 duration-state ease-out-quiet animate-in fade-in"
      />
      <aside
        aria-label={label}
        className={cn(
          "absolute inset-y-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-chrome shadow-e3 duration-state ease-out-quiet animate-in",
          side === "left" ? "left-0 slide-in-from-left-4" : "right-0 slide-in-from-right-4",
        )}
      >
        <div className="min-h-0 flex-1">{children}</div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Close ${label.toLowerCase()}`}
          onClick={onClose}
          className={cn("absolute top-1.5", side === "left" ? "right-1.5" : "left-1.5")}
        >
          <X />
        </Button>
      </aside>
    </>
  );
}
