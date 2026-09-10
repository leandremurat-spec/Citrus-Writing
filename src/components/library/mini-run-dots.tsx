import type { ChapterStatus } from "@/lib/binder/tree";
import { cn } from "@/lib/utils";

const DOT_CLASS: Record<ChapterStatus, string> = {
  DRAFT: "size-1.5 border-[1.5px] border-neutral-600 bg-transparent",
  EDITED: "size-2 bg-ochre-400",
  QUEUED: "size-2.5 bg-press-200 shadow-[inset_0_0_0_1.5px_var(--press)]",
  PUBLISHED: "size-2.5 bg-press",
};

/**
 * A quiet, non-interactive version of the Run band's dots for a novel's card in the Library
 * grid — the shape of the serial at a glance, without the size-by-word-count detail the real
 * Run band has room for.
 */
export function MiniRunDots({ statuses }: { statuses: ChapterStatus[] }) {
  if (statuses.length === 0) return null;
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-1">
      {statuses.map((status, index) => (
        <span key={index} className={cn("shrink-0 rounded-full", DOT_CLASS[status])} />
      ))}
    </div>
  );
}
