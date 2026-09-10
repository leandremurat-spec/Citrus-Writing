"use client";

import * as React from "react";

import type { DocNode } from "@/lib/editor/word-count";

/**
 * What the editor knows that the rest of the workspace needs: live word counts for the
 * binder, mention counts for the Codex panel, the current document for the export dialog,
 * and the writing status for the Progress panel.
 *
 * This is a module-level store rather than React context on purpose. Server actions call
 * `revalidatePath("/", "layout")`, which re-renders the workspace from the root; state held
 * in a provider is lost in that pass, and the binder and panels would snap back to saved
 * numbers until the next keystroke. A store outside the React tree is unaffected by
 * re-renders, and `useSyncExternalStore` keeps readers in step. The panels also live in a
 * different route slot from the editor, so props could not reach them anyway.
 */
export type SaveState = "saved" | "dirty" | "saving" | "error";

export interface WritingStatus {
  chapterId: string;
  /** Words in the chapter right now, including unsaved edits. */
  wordCount: number;
  sweetSpotMin: number;
  sweetSpotMax: number;
  /** Words added and removed in this chapter since it was opened. */
  sittingAdded: number;
  sittingRemoved: number;
  /** Today, in this novel. Counts are per story: they never carry between books. */
  novelWords: number;
  novelAdded: number;
  novelRemoved: number;
  /** Today, across every novel: what the daily goal and the streak measure. */
  todayWords: number;
  todayAdded: number;
  todayRemoved: number;
  dailyGoal: number;
  streak: number;
  streakAlive: boolean;
  saveState: SaveState;
}

type MentionCounts = Record<string, number>;

const counts = new Map<string, number>();
const mentions = new Map<string, MentionCounts>();
const docs = new Map<string, DocNode>();
let status: WritingStatus | null = null;

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

function sameCounts(a: MentionCounts | undefined, b: MentionCounts): boolean {
  if (!a) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameStatus(a: WritingStatus | null, b: WritingStatus): boolean {
  if (!a) return false;
  return (Object.keys(b) as (keyof WritingStatus)[]).every((key) => a[key] === b[key]);
}

// ---------- writes (called by the editor) ----------

export function setLiveCount(chapterId: string, count: number): void {
  if (counts.get(chapterId) === count) return;
  counts.set(chapterId, count);
  emit();
}

export function setLiveMentions(chapterId: string, next: MentionCounts): void {
  if (sameCounts(mentions.get(chapterId), next)) return;
  mentions.set(chapterId, next);
  emit();
}

/** The document as it stands in the editor, so exports include unsaved edits. */
export function setLiveDoc(chapterId: string, doc: DocNode): void {
  docs.set(chapterId, doc);
  emit();
}

export function setWritingStatus(next: WritingStatus): void {
  if (sameStatus(status, next)) return;
  status = next;
  emit();
}

/** Reading the document outside React (the export dialog opens on demand). */
export function getLiveDoc(chapterId: string): DocNode | null {
  return docs.get(chapterId) ?? null;
}

// ---------- reads ----------

/** The live count for a chapter, or the server value when the editor hasn't touched it. */
export function useLiveCount(chapterId: string, fallback: number): number {
  return React.useSyncExternalStore(
    subscribe,
    () => counts.get(chapterId) ?? fallback,
    () => fallback,
  );
}

/**
 * The live sum for a set of chapters — what a volume or arc row shows. Each chapter falls
 * back to its saved count, so the aggregate tracks the editor keystroke for keystroke on the
 * open chapter without waiting for a save.
 *
 * Pass a memoised array: the snapshot closes over it, and a fresh array every render would
 * make `useSyncExternalStore` re-read on every render for no reason.
 */
export function useLiveTotal(chapters: readonly { id: string; wordCount: number }[]): number {
  const read = React.useCallback(
    () => chapters.reduce((sum, chapter) => sum + (counts.get(chapter.id) ?? chapter.wordCount), 0),
    [chapters],
  );
  return React.useSyncExternalStore(subscribe, read, read);
}

/**
 * The open chapter's document as it stands in the editor. The codex panel scans this for
 * names written as plain text, so it notices one the moment it is typed rather than waiting
 * for a save and a revalidation.
 */
export function useLiveDoc(chapterId: string | null): DocNode | null {
  return React.useSyncExternalStore(
    subscribe,
    () => (chapterId ? (docs.get(chapterId) ?? null) : null),
    () => null,
  );
}

/** Mention counts by codex entry id, or null when the editor hasn't reported any yet. */
export function useLiveMentions(chapterId: string | null): MentionCounts | null {
  return React.useSyncExternalStore(
    subscribe,
    () => (chapterId ? (mentions.get(chapterId) ?? null) : null),
    () => null,
  );
}

/** The open chapter's writing status, or null when no chapter is open. */
export function useWritingStatus(chapterId: string | null): WritingStatus | null {
  return React.useSyncExternalStore(
    subscribe,
    () => (chapterId && status?.chapterId === chapterId ? status : null),
    () => null,
  );
}
