import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MentionThread as MentionThreadData } from "@/lib/data/codex";

/** An entry's thread through the run: every chapter in the novel, filled where it appears. */
export function MentionThread({ chapters, totalMentions }: MentionThreadData) {
  const chapterCount = chapters.filter((chapter) => chapter.mentioned).length;

  return (
    <div className="flex flex-col gap-3.5 rounded-[1.75rem] bg-card p-5">
      <div className="flex items-end gap-0">
        {chapters.map((chapter) => (
          <div key={chapter.chapterId} className="flex w-11 shrink-0 flex-col items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "rounded-full",
                chapter.mentioned ? "size-4 bg-press-600" : "size-1.5 border-[1.5px] border-neutral-600",
              )}
            />
            <span className="text-3xs text-subtle">{chapter.label}</span>
          </div>
        ))}
        <span className="ml-auto shrink-0 self-center pb-4 text-sm text-foreground/80">
          {pluralize(totalMentions, "mention")} across {pluralize(chapterCount, "chapter")}
        </span>
      </div>
    </div>
  );
}
