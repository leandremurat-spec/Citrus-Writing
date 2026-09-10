import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import type { NovelCard as NovelCardData } from "@/lib/data/novels";
import { formatNumber, pluralize } from "@/lib/format";

import { MiniRunDots } from "./mini-run-dots";

export function NovelCard({ novel }: { novel: NovelCardData }) {
  return (
    <Link
      href={`/novels/${novel.id}`}
      className="focus-ring flex flex-col gap-3.5 rounded-[1.75rem] bg-card p-6 shadow-e0 transition-[box-shadow] duration-tint ease-state hover:shadow-e2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {novel.lastWrittenAt && (
          <span className="text-2xs text-subtle">
            written {formatDistanceToNow(novel.lastWrittenAt, { addSuffix: true })}
          </span>
        )}
      </div>
      <h3 className="font-heading text-2xl leading-tight">{novel.title}</h3>
      {novel.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-foreground/80">{novel.description}</p>
      )}
      <MiniRunDots statuses={novel.runStatuses} />
      <p className="text-xs text-subtle">
        {pluralize(novel.chapterCount, "chapter")} · {formatNumber(novel.wordCount)} words
        {novel.arcCount > 0 && ` · ${pluralize(novel.arcCount, "arc")}`}
      </p>
    </Link>
  );
}
