"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { History, Loader2, Scissors, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { listSnapshots, restoreSnapshot } from "@/lib/actions/snapshots";
import type { SnapshotCard } from "@/lib/data/snapshots";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Surface } from "@/components/ui/surface";

const REASON_LABEL: Record<string, string> = {
  periodic: "Kept as you wrote",
  "large-cut": "Kept before a large cut",
  "before-restore": "Kept before a restore",
};

/**
 * Chapter history.
 *
 * Restoring hands the text back to the editor rather than reloading the page: a reload would
 * race the autosave that is probably already in flight, and the version you just restored
 * would be the one to lose.
 */
export function HistoryDialog({
  chapterId,
  onRestore,
}: {
  chapterId: string;
  /** Adopt the restored text in the open editor, without a round trip. */
  onRestore: (content: string, wordCount: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [snapshots, setSnapshots] = React.useState<SnapshotCard[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // The list is cleared where the dialog is opened, not here: a synchronous setState in an
    // effect body costs a second render pass for a value the opener already knows.
    void listSnapshots(chapterId).then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        toast.error(response.error);
        setSnapshots([]);
        return;
      }
      setSnapshots(response.snapshots);
    });
    return () => {
      cancelled = true;
    };
  }, [open, chapterId]);

  const restore = async (snapshotId: string) => {
    setBusyId(snapshotId);
    const response = await restoreSnapshot({ chapterId, snapshotId });
    setBusyId(null);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    onRestore(response.content, response.wordCount);
    setOpen(false);
    toast.success("Version restored.", { description: "The text you had a moment ago was kept too." });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSnapshots(null);
          setOpen(true);
        }}
        className="focus-ring flex items-center gap-1 rounded-md text-xs text-subtle transition-colors duration-tint ease-state hover:text-foreground"
      >
        <History className="size-3.5" aria-hidden /> History
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chapter history</DialogTitle>
            <DialogDescription>Restoring keeps the current text too.</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {snapshots === null && (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Looking…
              </p>
            )}

            {snapshots?.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">
                Nothing kept yet.
              </p>
            )}

            {snapshots?.map((snapshot, index) => (
              <Surface key={snapshot.id} tone={index === 0 ? "none" : "card"} className={cn("p-3", index === 0 && "bg-ochre-100")}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn("flex items-center gap-1.5 text-xs", index === 0 ? "text-ochre-900" : "text-foreground")}
                    suppressHydrationWarning
                  >
                    {snapshot.reason === "large-cut" && <Scissors className="size-3 text-ochre-700" aria-hidden />}
                    {formatDistanceToNow(snapshot.createdAt, { addSuffix: true })}
                  </span>
                  <span
                    className={cn("shrink-0 text-2xs tabular-nums", index === 0 ? "text-ochre-800" : "text-subtle")}
                  >
                    {formatNumber(snapshot.wordCount)} words
                  </span>
                </div>
                <p className={cn("mt-0.5 text-2xs", index === 0 ? "text-ochre-800" : "text-subtle")}>
                  {REASON_LABEL[snapshot.reason] ?? snapshot.reason}
                </p>
                <p className="mt-2 line-clamp-3 font-serif text-xs leading-relaxed text-foreground/80">
                  {snapshot.preview}
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className={cn("mt-2.5", busyId && busyId !== snapshot.id && "opacity-50")}
                  disabled={busyId !== null}
                  onClick={() => void restore(snapshot.id)}
                >
                  {busyId === snapshot.id ? <Loader2 className="animate-spin" /> : <Undo2 />} Restore this
                </Button>
              </Surface>
            ))}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
