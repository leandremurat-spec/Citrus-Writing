"use client";

import * as React from "react";

/**
 * The sprint timer's state.
 *
 * A module store, and outside React's tree on purpose: a sprint has to survive switching
 * chapters, and every chapter switch remounts the editor and re-renders the workspace from
 * the root. The end time is an absolute timestamp rather than a countdown, so the sprint is
 * still correct after a tab has been backgrounded and its timers throttled.
 */

export interface Sprint {
  /** Wall-clock end, ms since epoch. */
  endsAt: number;
  minutes: number;
  /** Net words for the day when the sprint started, so progress is a subtraction. */
  startedAtWords: number;
  target: number;
  done: boolean;
}

let sprint: Sprint | null = null;
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

export function startSprint(minutes: number, target: number, currentWords: number): void {
  sprint = {
    endsAt: Date.now() + minutes * 60_000,
    minutes,
    startedAtWords: currentWords,
    target,
    done: false,
  };
  emit();
}

export function stopSprint(): void {
  sprint = null;
  emit();
}

/** Marks the sprint finished without clearing it, so the result stays on screen. */
export function finishSprint(): void {
  if (!sprint || sprint.done) return;
  sprint = { ...sprint, done: true };
  emit();
}

export function useSprint(): Sprint | null {
  return React.useSyncExternalStore(
    subscribe,
    () => sprint,
    () => null,
  );
}

/**
 * Wall-clock now, rounded to the second. The rounding is what makes it a legal snapshot:
 * useSyncExternalStore requires a value that only changes when the subscription fires, and a
 * raw Date.now() would differ on every read. The interval runs only while a sprint does.
 */
export function useNow(active: boolean): number {
  return React.useSyncExternalStore(
    React.useCallback(
      (listener) => {
        if (!active) return () => {};
        const id = window.setInterval(listener, 1000);
        return () => window.clearInterval(id);
      },
      [active],
    ),
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );
}
