"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookText, Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createNovel, deleteNovel } from "@/lib/actions/novels";
import type { NovelSummary } from "@/lib/data/novels";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TitleDialog } from "@/components/binder/binder-dialogs";

export function NovelSwitcher({ novels, current }: { novels: NovelSummary[]; current: { id: string; title: string } }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        {/*
          The one place in the header that names the thing you are writing, so it is set in the
          display face rather than the chrome one and carries a tint of the brand — a quiet
          version of what the wordmark does, not another toolbar button.
        */}
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="max-w-72 gap-2 rounded-full bg-press-100 px-3 font-heading text-sm text-press-900 hover:bg-press-200"
            />
          }
          aria-label="Switch novel"
        >
          <BookText className="text-press" />
          <span className="truncate">{current.title}</span>
          <ChevronsUpDown className="text-press/70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          {/* Base UI requires a group label to sit inside a group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Novels</DropdownMenuLabel>
            {novels.map((novel) => (
              <DropdownMenuItem key={novel.id} onClick={() => router.push(`/novels/${novel.id}`)}>
                <Check className={cn("size-4", novel.id === current.id ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate">{novel.title}</span>
                <span className="text-xs text-muted-foreground">{pluralize(novel.chapterCount, "chapter")}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus /> New novel…
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 /> Delete “{current.title}”…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TitleDialog
        open={creating}
        onOpenChange={setCreating}
        heading="New novel"
        initialValue=""
        submitLabel="Create novel"
        onSubmit={async (title) => {
          const response = await createNovel({ title });
          if (!response.ok) {
            toast.error(response.error);
            return false;
          }
          router.push(`/novels/${response.id}/chapters/${response.chapterId}`);
        }}
      />

      {/*
        Deleting a serial cascades to every chapter, arc, codex entry and tie in it, and unlike
        a chapter there is no snapshot table behind it. So the confirmation asks the writer to
        type the title: `TitleDialog` already is a one-field form, and the server checks the
        answer again — a dialog that can be clicked through is not a confirmation.
      */}
      <TitleDialog
        key={current.id}
        open={deleting}
        onOpenChange={setDeleting}
        heading={`Delete “${current.title}”?`}
        description="Everything in it goes too, and none of it can be recovered."
        label="Type the title"
        initialValue=""
        submitLabel="Delete for good"
        onSubmit={async (confirmTitle) => {
          const response = await deleteNovel({ novelId: current.id, confirmTitle });
          if (!response.ok) {
            toast.error(response.error);
            return false;
          }
          toast.success(`“${current.title}” deleted`);
          router.push("/");
        }}
      />
    </>
  );
}
