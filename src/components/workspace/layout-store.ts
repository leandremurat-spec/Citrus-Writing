"use client";

import * as React from "react";

/**
 * Which side panels are showing, and the panel sizes.
 *
 * A module-level store rather than context, for the reason the rest of this app uses one:
 * the header, the shell and the keyboard shortcuts sit in different route slots, and
 * `revalidatePath("/", "layout")` re-renders the workspace from the root.
 *
 * Focus mode is not a fourth piece of state — it is simply both panels away. Deriving it
 * means the two can never disagree, and leaving focus mode restores whichever panels were
 * showing before, which is what a writer expects.
 */

export interface PanelSizes {
  binder: number;
  command: number;
}

const SIZES_KEY = "pith:panel-sizes";
const OPEN_KEY = "pith:panels-open";

export const DEFAULT_SIZES: PanelSizes = { binder: 288, command: 320 };

interface LayoutState {
  binderOpen: boolean;
  commandOpen: boolean;
  /** Remembered so leaving focus mode puts back what was there. */
  restore: { binder: boolean; command: boolean } | null;
}

let state: LayoutState = { binderOpen: true, commandOpen: true, restore: null };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(): LayoutState {
  if (loaded || typeof window === "undefined") return state;
  loaded = true;
  try {
    const stored = window.localStorage.getItem(OPEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LayoutState>;
      state = {
        binderOpen: parsed.binderOpen !== false,
        commandOpen: parsed.commandOpen !== false,
        restore: null,
      };
    }
  } catch {
    // Defaults are fine.
  }
  return state;
}

function commit(next: LayoutState) {
  state = next;
  try {
    window.localStorage.setItem(
      OPEN_KEY,
      JSON.stringify({ binderOpen: next.binderOpen, commandOpen: next.commandOpen }),
    );
  } catch {
    // Not persisting is survivable.
  }
  emit();
}

export function setBinderOpen(open: boolean): void {
  commit({ ...state, binderOpen: open, restore: null });
}

export function setCommandOpen(open: boolean): void {
  commit({ ...state, commandOpen: open, restore: null });
}

/** Both panels away, and back again to exactly what was showing before. */
export function toggleFocusMode(): void {
  const inFocus = !state.binderOpen && !state.commandOpen;
  if (inFocus) {
    const restore = state.restore ?? { binder: true, command: true };
    commit({ binderOpen: restore.binder, commandOpen: restore.command, restore: null });
  } else {
    commit({
      binderOpen: false,
      commandOpen: false,
      restore: { binder: state.binderOpen, command: state.commandOpen },
    });
  }
}

/**
 * True when the viewport cannot hold three columns. A media query rather than a container
 * query because the shell *is* the container — there is nothing outside it to measure
 * against. Read through useSyncExternalStore so it needs no state and no effect, and so the
 * server snapshot is the wide layout, which is what the server renders.
 */
const NARROW = "(max-width: 1023px)";

export function useNarrowLayout(): boolean {
  return React.useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

export function useWorkspaceLayout() {
  const value = React.useSyncExternalStore(subscribe, read, () => state);
  return {
    ...value,
    focusMode: !value.binderOpen && !value.commandOpen,
  };
}

/** Panel sizes, remembered between reloads — they used to be lost on every refresh. */
export function loadPanelSizes(): PanelSizes {
  if (typeof window === "undefined") return DEFAULT_SIZES;
  try {
    const stored = window.localStorage.getItem(SIZES_KEY);
    if (!stored) return DEFAULT_SIZES;
    const parsed = JSON.parse(stored) as Partial<PanelSizes>;
    return {
      binder: Number.isFinite(parsed.binder) ? Number(parsed.binder) : DEFAULT_SIZES.binder,
      command: Number.isFinite(parsed.command) ? Number(parsed.command) : DEFAULT_SIZES.command,
    };
  } catch {
    return DEFAULT_SIZES;
  }
}

let sizes: PanelSizes | null = null;

/*
 * Panels report their width on mount as well as on drag, and the mount report is the
 * *default* width — so recording every report meant the defaults overwrote the remembered
 * widths a frame before the restore could apply them, and sizes never survived a reload.
 *
 * Recording is therefore off until someone actually grabs a handle, and goes off again
 * whenever the panels are rebuilt (a toggle remounts them at their defaults).
 */
let recording = false;

export function startRecordingSizes(): void {
  recording = true;
}

export function stopRecordingSizes(): void {
  recording = false;
}

/**
 * Record a panel's width as it is dragged. A panel narrower than this is mid-teardown, not a
 * width anyone chose; remembering it would make the next "show" expand to nothing.
 */
export function rememberPanelSize(key: keyof PanelSizes, inPixels: number): void {
  if (!recording || inPixels < 40) return;
  sizes = { ...(sizes ?? loadPanelSizes()), [key]: Math.round(inPixels) };
  try {
    window.localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
  } catch {
    // Not persisting is survivable.
  }
}
