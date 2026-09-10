import { ArrowRight } from "lucide-react";

import type { UnlinkedSummaryChapter } from "@/lib/data/codex";
import { formatNumber, pluralize } from "@/lib/format";

/**
 * A read-only, whole-novel counterpart to `UnlinkedMentions` (which scans only the live,
 * currently-open chapter). Nothing here can link a mention itself — there is no live editor
 * to hand a rewrite to for a chapter that is not open — so it points at the chapter instead,
 * where the existing, safe, editor-based linking flow already lives.
 */
export function UnlinkedSummary({
  entryName,
  summary,
  onOpenChapter,
}: {
  entryName: string;
  summary: UnlinkedSummaryChapter[];
  onOpenChapter: (chapterId: string) => void;
}) {
  const total = summary.reduce((sum, chapter) => sum + chapter.count, 0);

  return (
    <div className="flex flex-col gap-2.5 rounded-[1.75rem] bg-ochre-100 p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-heading text-lg text-ochre-900">Unlinked mentions</h2>
        <span className="rounded-full bg-press-100 px-2.5 py-0.5 text-2xs text-press-800">
          {formatNumber(total)} found
        </span>
      </div>
      <p className="text-sm leading-relaxed text-ochre-900">
        The name <strong>{entryName}</strong> appears as plain text in {pluralize(summary.length, "chapter")} that
        {summary.length === 1 ? " has" : " have"} not linked it yet.
      </p>
      <div className="flex flex-col gap-1">
        {summary.map((chapter) => (
          <button
            key={chapter.chapterId}
            type="button"
            onClick={() => onOpenChapter(chapter.chapterId)}
            className="focus-ring-inset flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-sm text-ochre-800 transition-colors duration-tint ease-state hover:bg-ochre-200"
          >
            <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
            <span className="shrink-0 text-2xs tabular-nums opacity-80">{pluralize(chapter.count, "time")}</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          </button>
        ))}
      </div>
      <p className="text-2xs text-ochre-800">Open a chapter to link them.</p>
    </div>
  );
}
