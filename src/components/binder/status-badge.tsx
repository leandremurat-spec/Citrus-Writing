import { STATUS_META } from "@/lib/binder/status";
import type { ChapterStatus } from "@/lib/binder/tree";
import { cn } from "@/lib/utils";

export function StatusDot({
  status,
  className,
  title,
}: {
  status: ChapterStatus;
  className?: string;
  title?: string;
}) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_META[status].dot, className)}
    />
  );
}

export function StatusBadge({ status, className }: { status: ChapterStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs leading-none font-medium",
        meta.badge,
        className,
      )}
    >
      {/* The icon, not the tint, is what tells Queued from Published without colour. */}
      <meta.icon className="size-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}
