"use client";

import * as React from "react";

import {
  APPEARANCE_DEFAULTS,
  APPEARANCE_KEY,
  appearanceVars,
  normalizeAppearance,
  type Appearance,
} from "@/lib/settings/appearance";

/*
 * A module-level store read with useSyncExternalStore, for the same reason the live word
 * counts are one: server actions call `revalidatePath("/", "layout")`, which re-renders the
 * workspace from the root, and provider state does not reliably survive that. The settings
 * panel and the writing canvas also sit in different route slots, so props cannot reach
 * between them.
 */

let current: Appearance = APPEARANCE_DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

/** Push the values CSS needs onto <html>, where every panel can see them. */
export function applyAppearanceVars(next: Appearance) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(appearanceVars(next))) style.setProperty(name, value);
  document.documentElement.dataset.typewriter = next.typewriter ? "on" : "off";
  document.documentElement.dataset.dimOthers = next.dimOthers ? "on" : "off";
}

function read(): Appearance {
  if (loaded || typeof window === "undefined") return current;
  loaded = true;
  try {
    const stored = window.localStorage.getItem(APPEARANCE_KEY);
    if (stored) current = normalizeAppearance(JSON.parse(stored));
  } catch {
    // Unreadable or unparsable storage just means the defaults.
  }
  return current;
}

export function setAppearance(patch: Partial<Appearance>): void {
  current = normalizeAppearance({ ...current, ...patch });
  try {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current));
  } catch {
    // Private mode or quota: the session still honours the change, it just won't persist.
  }
  applyAppearanceVars(current);
  emit();
}

export function resetAppearance(): void {
  setAppearance(APPEARANCE_DEFAULTS);
}

/**
 * The server snapshot is the defaults, which is what the server rendered — so the first paint
 * matches and hydration is quiet; the stored values are read on the client immediately after.
 */
export function useAppearance(): Appearance {
  return React.useSyncExternalStore(subscribe, read, () => APPEARANCE_DEFAULTS);
}
