import { cn } from "@/lib/utils";
import type { CodexCategory } from "@/lib/codex/types";

import { CATEGORY_META, initials } from "./category-meta";

/** A portrait image, or an initials badge tinted by category — the one avatar treatment
    shared by the codex list, the entry detail header, and its ties. */
export function EntryAvatar({
  name,
  category,
  avatarUrl,
  className,
}: {
  name: string;
  category: CodexCategory;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- author-supplied URLs, unoptimised on purpose
    return <img src={avatarUrl} alt="" className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        CATEGORY_META[category].tint,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
