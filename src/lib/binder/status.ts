import { Check, Clock, Globe, PencilLine, type LucideIcon } from "lucide-react";

import type { ChapterStatus } from "@/lib/binder/tree";

export const CHAPTER_STATUSES: readonly ChapterStatus[] = ["DRAFT", "EDITED", "QUEUED", "PUBLISHED"];

export interface StatusMeta {
  label: string;
  description: string;
  /** Tailwind classes for the small status dot. */
  dot: string;
  /** Tailwind classes for the pill badge. */
  badge: string;
  /** The non-colour signal. A dot alone cannot carry four states. */
  icon: LucideIcon;
}

/*
 * The four states read as a progression in *fill*, not only in hue: empty ring →
 * solid sage → outlined terracotta → solid terracotta. Every badge also carries
 * an icon, so the pill never depends on hue alone. Colours and steps match the
 * handoff's binder rows exactly (e.g. the EDITED dot is accent-2-400, the
 * PUBLISHED dot is the base accent).
 */
export const STATUS_META: Record<ChapterStatus, StatusMeta> = {
  DRAFT: {
    label: "Draft",
    description: "Still being written",
    dot: "border border-neutral-600",
    badge: "bg-neutral-200 text-neutral-800",
    icon: PencilLine,
  },
  EDITED: {
    label: "Edited",
    description: "Revised and ready to queue",
    dot: "bg-ochre-400",
    badge: "bg-ochre-100 text-ochre-800",
    icon: Check,
  },
  QUEUED: {
    label: "Queued",
    description: "Waiting for release",
    dot: "border-2 border-press bg-press-200",
    badge: "bg-press-100 text-press-800 ring-1 ring-press-400 ring-inset",
    icon: Clock,
  },
  PUBLISHED: {
    label: "Published",
    description: "Live for readers",
    dot: "bg-press",
    badge: "bg-press-200 text-press-800",
    icon: Globe,
  },
};

export function isChapterStatus(value: unknown): value is ChapterStatus {
  return typeof value === "string" && (CHAPTER_STATUSES as readonly string[]).includes(value);
}
