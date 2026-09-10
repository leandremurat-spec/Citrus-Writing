"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { createCodexEntry, updateCodexEntry } from "@/lib/actions/codex";
import { CODEX_CATEGORIES, type CodexCategory, type CodexEntryCard } from "@/lib/codex/types";
import type { SheetField } from "@/lib/codex/sheet-fields";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { CATEGORY_META } from "./category-meta";

export interface CodexDraft {
  name?: string;
  category?: CodexCategory;
}

/** The one field the create/edit dialog doesn't get from `CodexEntryCard`, which is the
    list-view shape and carries no sheet data. Passed in only when editing. */
interface FormValues {
  name: string;
  category: CodexCategory;
  summary: string;
  description: string;
  aliases: string;
  avatarUrl: string;
  sheetFields: SheetField[];
}

function toValues(entry: CodexEntryCard | null, draft: CodexDraft | null): FormValues {
  return {
    name: entry?.name ?? draft?.name ?? "",
    category: entry?.category ?? draft?.category ?? "CHARACTER",
    summary: entry?.summary ?? "",
    description: entry?.description ?? "",
    aliases: entry?.aliases ?? "",
    avatarUrl: entry?.avatarUrl ?? "",
    sheetFields: entry?.sheetFields ?? [],
  };
}

/** Create or edit a codex entry. `entry` null means create. */
export function CodexFormDialog({
  open,
  onOpenChange,
  novelId,
  entry,
  draft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  entry: CodexEntryCard | null;
  draft?: CodexDraft | null;
  onSaved: (entry: CodexEntryCard) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        {open && (
          <CodexForm
            key={entry?.id ?? "new"}
            novelId={novelId}
            entry={entry}
            draft={draft ?? null}
            onSaved={onSaved}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CodexForm({
  novelId,
  entry,
  draft,
  onSaved,
  onOpenChange,
}: {
  novelId: string;
  entry: CodexEntryCard | null;
  draft: CodexDraft | null;
  onSaved: (entry: CodexEntryCard) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = React.useState<FormValues>(() => toValues(entry, draft));
  const [pending, startTransition] = React.useTransition();
  const ids = React.useId();
  const field = (name: string) => `${ids}-${name}`;
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;
    startTransition(async () => {
      const payload = {
        name: values.name.trim(),
        category: values.category,
        summary: values.summary.trim(),
        description: values.description.trim(),
        aliases: values.aliases.trim(),
        avatarUrl: values.avatarUrl.trim(),
        sheetFields: values.sheetFields.filter((sheetField) => sheetField.label.trim() && sheetField.value.trim()),
      };
      const response = entry
        ? await updateCodexEntry({ id: entry.id, ...payload })
        : await createCodexEntry({ novelId, ...payload });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      // The action returns a fresh row; keep the counts we already knew about.
      onSaved({
        ...response.entry,
        chapterCount: entry?.chapterCount ?? 0,
        mentionedIn: entry?.mentionedIn ?? [],
      });
      toast.success(entry ? "Entry updated" : `${CATEGORY_META[values.category].singular} created`);
      onOpenChange(false);
    });
  };

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>{entry ? `Edit ${entry.name}` : "New codex entry"}</DialogTitle>
      </DialogHeader>

      <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-0.5">
        <div className="grid gap-2">
          <Label>Type</Label>
          <div className="flex gap-1.5">
            {CODEX_CATEGORIES.map((category) => {
              const meta = CATEGORY_META[category];
              const active = values.category === category;
              return (
                <Button
                  key={category}
                  type="button"
                  variant={active ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={active}
                  className={cn("flex-1", active && "ring-1 ring-press/50")}
                  onClick={() => set("category", category)}
                >
                  <meta.icon className={active ? meta.text : undefined} />
                  {meta.singular}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("name")}>Name</Label>
          <Input
            id={field("name")}
            autoFocus
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Wren Ashcombe"
            maxLength={120}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("summary")}>Tagline</Label>
          <Input
            id={field("summary")}
            value={values.summary}
            onChange={(event) => set("summary", event.target.value)}
            placeholder="Lamplighter of the Ninth Pier."
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground"></p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("description")}>Lore</Label>
          <Textarea
            id={field("description")}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Anything worth remembering."
            className="min-h-28 font-serif"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("aliases")}>Also known as</Label>
          <Input
            id={field("aliases")}
            value={values.aliases}
            onChange={(event) => set("aliases", event.target.value)}
            placeholder="Wren, the lamplighter"
            maxLength={300}
          />
          <p className="text-xs text-muted-foreground">Also match when you type @.</p>
        </div>

        <div className="grid gap-2">
          <Label>Character sheet</Label>
          <SheetFieldsEditor
            fields={values.sheetFields}
            onChange={(sheetFields) => set("sheetFields", sheetFields)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={field("avatar")}>Portrait URL</Label>
          <Input
            id={field("avatar")}
            type="url"
            inputMode="url"
            value={values.avatarUrl}
            onChange={(event) => set("avatarUrl", event.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !values.name.trim()}>
          {entry ? "Save changes" : "Create entry"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A repeatable label/value list — Role, Wants, Fears, Tell, or whatever a writer names them.
    Blank rows are dropped on save rather than blocked here, so starting a new row never
    fights the writer over an empty label. */
function SheetFieldsEditor({
  fields,
  onChange,
}: {
  fields: SheetField[];
  onChange: (fields: SheetField[]) => void;
}) {
  const update = (index: number, patch: Partial<SheetField>) =>
    onChange(fields.map((sheetField, i) => (i === index ? { ...sheetField, ...patch } : sheetField)));
  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-1.5">
      {fields.map((sheetField, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            value={sheetField.label}
            onChange={(event) => update(index, { label: event.target.value })}
            placeholder="Label"
            maxLength={60}
            className="w-28 shrink-0"
          />
          <Input
            value={sheetField.value}
            onChange={(event) => update(index, { value: event.target.value })}
            placeholder="Value"
            maxLength={500}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${sheetField.label || "field"}`}
            onClick={() => remove(index)}
          >
            <X />
          </Button>
        </div>
      ))}
      {fields.length < 12 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...fields, { label: "", value: "" }])}
        >
          <Plus /> Add a field
        </Button>
      )}
    </div>
  );
}
