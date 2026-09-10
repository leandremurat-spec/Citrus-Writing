"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine, Plus } from "lucide-react";
import { toast } from "sonner";

import { createChapter } from "@/lib/actions/binder";
import type { ContainerRef } from "@/lib/binder/tree";
import { Button } from "@/components/ui/button";

export function EmptyCanvas({
  novelId,
  parent,
  parentLabel,
}: {
  novelId: string;
  parent: ContainerRef;
  parentLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const create = () =>
    startTransition(async () => {
      const response = await createChapter({ novelId, parent });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      router.push(`/novels/${novelId}/chapters/${response.id}`);
    });

  return (
    <main aria-label="Manuscript" className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <PenLine className="mx-auto size-7 text-press" />
        <h2 className="mt-4 font-serif text-2xl font-semibold">No chapter open</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a chapter in the binder, or start a fresh one in {parentLabel}.
        </p>
        <Button className="mt-5" onClick={create} disabled={pending}>
          <Plus /> New chapter
        </Button>
      </div>
    </main>
  );
}
