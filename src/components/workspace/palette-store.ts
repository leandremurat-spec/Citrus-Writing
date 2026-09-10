"use client";

import * as React from "react";

import { DEFAULT_PALETTE, isPaletteId, type PaletteId } from "@/lib/theme/palettes";

/**
 * Which palette this device is set to. The second axis beside next-themes' light/dark, and
 * stored the same way for the same reason: a palette is a fact about *this screen*, not about
 * the writer's account. Same argument as the appearance store — see
 * src/lib/settings/appearance.ts.
 *
 * A module-level store read with useSyncExternalStore, matching the appearance and live-count
 * stores, because server actions call `revalidatePath("/", "layout")` and provider state does
 * not reliably survive that.
 *
 * This is deliberately *not* folded into the appearance store, even though both end up in
 * localStorage. The appearance store applies its values from an effect, which is fine for a
 * measure or a type size and would be a visible flash for a whole colour scheme. The palette
 * has to be on <html> before first paint, which means an inline script that reads storage
 * directly — and a script small enough to inline should be parsing a bare string, not JSON
 * with a normalizer. Hence its own key, holding one word.
 */

export const PALETTE_KEY = "citrus:palette";
/** Read by the inline script and by the app. `data-palette` on <html>. */
export const PALETTE_ATTRIBUTE = "data-palette";

let current: PaletteId = DEFAULT_PALETTE;
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(): PaletteId {
  if (loaded || typeof window === "undefined") return current;
  loaded = true;
  try {
    // The attribute rather than storage: the inline script has already resolved and validated
    // it, and reading the DOM means the store cannot disagree with what is on screen.
    const applied = document.documentElement.getAttribute(PALETTE_ATTRIBUTE);
    if (isPaletteId(applied)) current = applied;
  } catch {
    // Nothing to recover: the default is already in `current`.
  }
  return current;
}

export function setPalette(next: PaletteId): void {
  if (!isPaletteId(next)) return;
  current = next;
  document.documentElement.setAttribute(PALETTE_ATTRIBUTE, next);
  try {
    window.localStorage.setItem(PALETTE_KEY, next);
  } catch {
    // Private mode or quota: the session honours the change, it just will not persist.
  }
  for (const listener of listeners) listener();
}

/**
 * The server snapshot is the default palette, which is what the server rendered — so the first
 * paint matches and hydration stays quiet. The stored value is picked up on the client
 * immediately afterwards, off the attribute the inline script already set.
 */
export function usePalette(): PaletteId {
  return React.useSyncExternalStore(subscribe, read, () => DEFAULT_PALETTE);
}
