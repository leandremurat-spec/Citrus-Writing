"use client";

import * as React from "react";

import { NODE_TYPE_LABEL, type BinderNode } from "@/lib/binder/tree";
import { formatNumber } from "@/lib/format";
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

interface TitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description?: string;
  label?: string;
  initialValue: string;
  submitLabel: string;
  /** Return `false` to keep the dialog open (for example after a failed save). */
  onSubmit: (value: string) => Promise<boolean | void> | boolean | void;
}

/** A single-field dialog used for renaming and for naming new arcs, volumes, and novels. */
export function TitleDialog({ open, onOpenChange, ...form }: TitleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent showCloseButton={false}>
        {open && <TitleForm key={form.initialValue} {...form} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function TitleForm({
  heading,
  description,
  label = "Title",
  initialValue,
  submitLabel,
  onSubmit,
  onOpenChange,
}: Omit<TitleDialogProps, "open">) {
  const [value, setValue] = React.useState(initialValue);
  const [pending, startTransition] = React.useTransition();
  const inputId = React.useId();
  const trimmed = value.trim();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    startTransition(async () => {
      const keepOpen = (await onSubmit(trimmed)) === false;
      if (!keepOpen) onOpenChange(false);
    });
  };

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.target.select()}
          maxLength={200}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !trimmed}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: BinderNode | null;
  /** Return `false` to keep the dialog open. */
  onConfirm: () => Promise<boolean | void> | boolean | void;
}

export function DeleteDialog({ open, onOpenChange, node, onConfirm }: DeleteDialogProps) {
  const [pending, startTransition] = React.useTransition();
  const isChapter = node?.type === "chapter";

  return (
    <AlertDialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {node ? NODE_TYPE_LABEL[node.type].toLowerCase() : "item"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {node && isChapter
              ? `“${node.title}” and its ${formatNumber(node.wordCount ?? 0)} words will be deleted permanently.`
              : node
                ? `“${node.title}” will be removed. Chapters and arcs inside it move up one level and keep their order.`
                : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const keepOpen = (await onConfirm()) === false;
                if (!keepOpen) onOpenChange(false);
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Return `false` to keep the dialog open. */
  onConfirm: () => Promise<boolean | void> | boolean | void;
}

/**
 * The plain destructive confirmation, for the cases `DeleteDialog` cannot describe because
 * they are not about a single binder node — a bulk delete being the first of them.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, startTransition] = React.useTransition();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const keepOpen = (await onConfirm()) === false;
                if (!keepOpen) onOpenChange(false);
              })
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
