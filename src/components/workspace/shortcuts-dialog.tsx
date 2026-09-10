"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** `mod` is rendered as ⌘ or Ctrl once we know which machine this is. */
interface Shortcut {
  keys: string[];
  action: string;
}

const GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: "Getting around",
    shortcuts: [
      { keys: ["mod", "K"], action: "Search chapters and commands" },
      { keys: ["mod", "alt", "↑ / ↓"], action: "Previous / next chapter" },
      { keys: ["mod", "\\"], action: "Focus mode — both panels away" },
      { keys: ["mod", "/"], action: "This list" },
    ],
  },
  {
    title: "In the binder",
    shortcuts: [
      { keys: ["↑ / ↓"], action: "Move between rows" },
      { keys: ["← / →"], action: "Close / open a volume or arc" },
      { keys: ["Enter"], action: "Open the chapter" },
      { keys: ["Home / End"], action: "First / last row" },
    ],
  },
  {
    title: "While writing",
    shortcuts: [
      { keys: ["@"], action: "Link or create a codex entry" },
      { keys: ["/"], action: "Headings, quote, lists, scene break" },
      { keys: ["mod", "B / I / U"], action: "Bold, italic, underline" },
      { keys: ["## "], action: "Scene title (also ### , > , - , 1. , ---)" },
    ],
  },
];

/**
 * The shortcuts sheet.
 *
 * The keyboard paths this app added — the palette, focus mode, the tree's arrows, `/` — are
 * all invisible until someone tells you they exist. `mod` renders as ⌘ or Ctrl per platform,
 * decided after hydration so the server's guess is never briefly wrong on screen.
 */
export function ShortcutsDialog() {
  const [open, setOpen] = React.useState(false);

  // Hydration-safe platform read: the server snapshot is `false`, so it renders "Ctrl" first
  // and corrects on the client without a setState in an effect.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const mod = mounted && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press {mod}+/ any time to bring this back.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="label-section mb-2">{group.title}</h3>
              <dl className="flex flex-col gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.action} className="flex items-baseline justify-between gap-4">
                    <dt className="min-w-0 text-xs text-muted-foreground">{shortcut.action}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Key key={key}>{key === "mod" ? mod : key === "alt" ? "Alt" : key}</Key>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Key({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1.5 font-sans text-2xs text-foreground ring-1 ring-edge ring-inset",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
