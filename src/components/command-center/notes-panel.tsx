"use client";

import * as React from "react";
import { toast } from "sonner";

import { updateChapterNotes } from "@/lib/actions/chapters";
import { Textarea } from "@/components/ui/textarea";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 700;

/** Per-chapter scratch notes with debounced autosave. */
export function NotesPanel({ chapterId, initialNotes }: { chapterId: string; initialNotes: string | null }) {
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [state, setState] = React.useState<SaveState>("idle");
  const timer = React.useRef<number | undefined>(undefined);
  const latest = React.useRef({ value: initialNotes ?? "", dirty: false });

  const save = React.useCallback(
    async (value: string) => {
      window.clearTimeout(timer.current);
      latest.current.dirty = false;
      setState("saving");
      const response = await updateChapterNotes({ chapterId, notes: value });
      if (response.ok) {
        setState("saved");
      } else {
        setState("error");
        toast.error(response.error);
      }
    },
    [chapterId],
  );

  const handleChange = (value: string) => {
    setNotes(value);
    setState("dirty");
    latest.current = { value, dirty: true };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(value), SAVE_DELAY_MS);
  };

  // Flush a pending edit if the panel unmounts (chapter switch, tab close) before the timer fires.
  React.useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      if (latest.current.dirty) void updateChapterNotes({ chapterId, notes: latest.current.value });
    };
  }, [chapterId]);

  const hint =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Not saved. Try again."
          : state === "dirty"
            ? "Unsaved changes"
            : "Private to this chapter. Saves as you type.";

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <Textarea
        value={notes}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          if (latest.current.dirty) void save(latest.current.value);
        }}
        placeholder="Plot beats and reminders…"
        aria-label="Chapter notes"
        // 14px, not the manuscript's 16px. This panel is 200–300px wide depending on where the
        // writer has dragged the divider, and at 16px that is barely twenty characters a line —
        // a ribbon, not a notes field. The manuscript earns 16px because it sits in a 46rem
        // column; nothing in a sidebar does. `md:text-sm` has to be spelled out because the
        // Textarea primitive ships `text-base md:text-sm` and would otherwise win at desktop
        // widths — the same trap the old `md:text-base` here was written to sidestep.
        // `rounded-none` because this field paints no box of its own — and a textarea's radius
        // clips its own text, so the primitive's corner was cutting through the first line.
        // `focus-ring-inset` replaces a `focus-visible:ring-0` that left the field with no
        // focus indicator at all; inset because the panel gives it no room for a halo.
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-1 font-serif text-sm leading-relaxed field-sizing-fixed focus-ring-inset md:text-sm dark:bg-transparent"
      />
      <p className="mt-2 shrink-0 text-2xs text-subtle" aria-live="polite">
        {hint}
      </p>
    </div>
  );
}
