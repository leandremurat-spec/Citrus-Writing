"use client";

import * as React from "react";
import { toast } from "sonner";

import { deleteCodexEntry } from "@/lib/actions/codex";
import type { CodexEntryCard } from "@/lib/codex/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { pluralize } from "@/lib/format";

import { CodexFormDialog, type CodexDraft } from "./codex-form-dialog";

/**
 * The novel's codex, shared by the editor's @ popover (center panel) and the Codex panel
 * (right panel). They live in different route slots, so the list lives in the layout and both
 * read it from here: an entry created from the @ popover appears in the panel immediately.
 */
interface CodexState {
  novelId: string;
  entries: CodexEntryCard[];
  byId: ReadonlyMap<string, CodexEntryCard>;
  /** Adds or replaces an entry locally, before the server revalidation lands. */
  upsert: (entry: CodexEntryCard) => void;
  openCreate: (draft?: CodexDraft) => void;
  openEdit: (id: string) => void;
  confirmDelete: (id: string) => void;
}

const CodexContext = React.createContext<CodexState | null>(null);

export function useCodex(): CodexState {
  const context = React.useContext(CodexContext);
  if (!context) throw new Error("useCodex must be used inside <CodexProvider>.");
  return context;
}

/** Safe outside the provider (the welcome screen and 404 render without one). */
export function useOptionalCodex(): CodexState | null {
  return React.useContext(CodexContext);
}

type DialogState = { mode: "create"; draft: CodexDraft | null } | { mode: "edit"; id: string } | null;

export function CodexProvider({
  novelId,
  entries: serverEntries,
  children,
}: {
  novelId: string;
  entries: CodexEntryCard[];
  children: React.ReactNode;
}) {
  const [entries, setEntries] = React.useState(serverEntries);
  const [synced, setSynced] = React.useState(serverEntries);
  // Fresh server data (after any revalidation) replaces the local copy.
  if (synced !== serverEntries) {
    setSynced(serverEntries);
    setEntries(serverEntries);
  }

  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const byId = React.useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const upsert = React.useCallback((entry: CodexEntryCard) => {
    setEntries((previous) => {
      const index = previous.findIndex((candidate) => candidate.id === entry.id);
      const next = index >= 0 ? previous.with(index, entry) : [...previous, entry];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const openCreate = React.useCallback((draft?: CodexDraft) => setDialog({ mode: "create", draft: draft ?? null }), []);
  const openEdit = React.useCallback((id: string) => setDialog({ mode: "edit", id }), []);
  const confirmDelete = React.useCallback((id: string) => setDeleting(id), []);

  const value = React.useMemo(
    () => ({ novelId, entries, byId, upsert, openCreate, openEdit, confirmDelete }),
    [novelId, entries, byId, upsert, openCreate, openEdit, confirmDelete],
  );

  const editing = dialog?.mode === "edit" ? (byId.get(dialog.id) ?? null) : null;
  const pendingDelete = deleting ? (byId.get(deleting) ?? null) : null;

  const runDelete = async () => {
    if (!pendingDelete) return;
    const response = await deleteCodexEntry({ id: pendingDelete.id });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setEntries((previous) => previous.filter((entry) => entry.id !== pendingDelete.id));
    setDeleting(null);
    toast.success(`${pendingDelete.name} removed from the codex`);
  };

  return (
    <CodexContext.Provider value={value}>
      {children}

      <CodexFormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        novelId={novelId}
        entry={editing}
        draft={dialog?.mode === "create" ? dialog.draft : null}
        onSaved={upsert}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.chapterCount > 0
                ? `The entry and its lore are deleted. The @mentions already written in ${pluralize(
                    pendingDelete.chapterCount,
                    "chapter",
                  )} stay in the text as plain tags.`
                : "The entry and its lore are deleted. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void runDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CodexContext.Provider>
  );
}
