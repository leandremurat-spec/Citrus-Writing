import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The mark: a citrus fruit, half-peeled to its segments — the "Citrus Writing" identity
 * from the Claude Design handoff. A raster asset (public/citrus-mark.png) rather than an
 * inline SVG, since that's the form it was designed and exported in.
 *
 * `suppressHydrationWarning` is belt-and-braces against extensions that rewrite inline styles
 * before React hydrates — `next/image` renders `style="color:transparent"` here to hide alt
 * text while the file loads, which is a target for that class of thing. The real fix for the
 * common case is the `darkreader-lock` meta tag in the root layout; this covers the rest, and
 * is scoped to this element's own attributes rather than its subtree. There is nothing here
 * that could legitimately differ between server and client: a fixed src at a fixed size.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <Image
      src="/citrus-mark.png"
      alt=""
      width={34}
      height={34}
      className={cn("size-4 object-contain", className)}
      priority
      suppressHydrationWarning
    />
  );
}

/**
 * The wordmark: the mark beside the name, set in the display face.
 *
 * `nameClassName` is for the one caller that has to drop the name — the workspace header runs
 * out of room for it long before it runs out of room for the controls beside it, and the mark
 * alone still reads as the way home.
 */
export function Wordmark({ className, nameClassName }: { className?: string; nameClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Mark className="size-5" />
      <span className={cn("font-heading text-sm leading-none whitespace-nowrap", nameClassName)}>Citrus Writing</span>
    </span>
  );
}
