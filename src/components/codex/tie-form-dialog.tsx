"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { createCodexTie } from "@/lib/actions/codex-ties";
import type { CodexCategory } from "@/lib/codex/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CATEGORY_META } from "./category-meta";
import { EntryAvatar } from "./entry-avatar";

export interface TieCandidate {
  id: string;
  name: string;
  category: CodexCategory;
}

/** "Add a tie": pick another entry, say what it is in a sentence, give it a short tag. */
export function TieFormDialog({
  open,
  onOpenChange,
  novelId,
  fromEntryId,
  fromEntryName,
  candidates,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  fromEntryId: string;
  fromEntryName: string;
  candidates: TieCandidate[];
  onCreated: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        {open && (
          <TieForm
            novelId={novelId}
            fromEntryId={fromEntryId}
            fromEntryName={fromEntryName}
            candidates={candidates}
            onOpenChange={onOpenChange}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TieForm({
  novelId,
  fromEntryId,
  fromEntryName,
  candidates,
  onOpenChange,
  onCreated,
}: {
  novelId: string;
  fromEntryId: string;
  fromEntryName: string;
  candidates: TieCandidate[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [targetId, setTargetId] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const ids = React.useId();

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) => candidate.name.toLowerCase().includes(q));
  }, [candidates, query]);

  const target = candidates.find((candidate) => candidate.id === targetId) ?? null;
  const canSubmit = Boolean(target && label.trim() && description.trim());

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || !canSubmit) return;
    startTransition(async () => {
      const response = await createCodexTie({
        novelId,
        fromEntryId,
        toEntryId: target.id,
        label: label.trim(),
        description: description.trim(),
      });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success("Tie added");
      onCreated();
      onOpenChange(false);
    });
  };

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>Add a tie</DialogTitle>
        <DialogDescription>How {fromEntryName} relates to someone or something else in the codex.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        {target ? (
          <div className="flex items-center gap-2.5 rounded-md bg-muted/60 px-2.5 py-2">
            <EntryAvatar name={target.name} category={target.category} className="size-7 text-2xs" />
            <span className="min-w-0 flex-1 truncate text-sm">{target.name}</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => setTargetId(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-search`}>Tied to</Label>
            <Input
              id={`${ids}-search`}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the codex…"
            />
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-md ring-1 ring-edge">
              {visible.length === 0 ? (
                <p className="p-2.5 text-xs text-muted-foreground">No other entries match.</p>
              ) : (
                visible.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setTargetId(candidate.id)}
                    className="focus-ring-inset flex items-center gap-2.5 px-2.5 py-1.5 text-left text-sm transition-colors duration-tint ease-state hover:bg-muted/60"
                  >
                    <EntryAvatar name={candidate.name} category={candidate.category} className="size-6 text-3xs" />
                    <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                    <span className={cn("text-2xs", CATEGORY_META[candidate.category].text)}>
                      {CATEGORY_META[candidate.category].singular}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor={`${ids}-label`}>Tag</Label>
          <Input
            id={`${ids}-label`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="mentor, carries, rival…"
            maxLength={40}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${ids}-description`}>In a sentence</Label>
          <Input
            id={`${ids}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Refused her twice, then taught her anyway."
            maxLength={300}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !canSubmit}>
          <Check /> Add tie
        </Button>
      </DialogFooter>
    </form>
  );
}
